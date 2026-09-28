#!/usr/bin/env python3
"""Retain complete Docker images and prune obsolete manifest graphs."""

import argparse
import datetime
import heapq
import json
import re
import subprocess
import sys


INDEX_TYPES = {
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
}
MANIFEST_TYPES = {
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
}
DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")


def command_json(command):
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Command failed")
    return json.loads(result.stdout)


def created_at(image):
    timestamp = image.get("createTime") or image.get("uploadTime")
    if not timestamp:
        raise ValueError("Missing image creation time; refusing to guess retention order")
    return datetime.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def prune(package, project, keep, dry_run):
    print(f"==> Inspecting manifest dependencies for {package}", flush=True)
    images = command_json([
        "gcloud", "artifacts", "docker", "images", "list", package,
        "--include-tags", "--format=json", f"--project={project}",
    ])
    if not isinstance(images, list):
        raise ValueError("Unexpected image list; no images were deleted")
    records = {}
    for image in images:
        # The CLI can include nested image paths; only prune the exact package.
        if image.get("package") != package:
            continue
        digest = image.get("version", "")
        if not DIGEST.fullmatch(digest):
            raise ValueError(f"Invalid manifest digest: {digest!r}")
        records[digest] = image
    if not records:
        print("    no images to prune")
        return

    times = {digest: created_at(image) for digest, image in records.items()}
    children = {digest: set() for digest in records}
    for digest, image in records.items():
        media_type = image.get("metadata", {}).get("mediaType")
        if media_type in MANIFEST_TYPES:
            continue
        # Read indexes (and manifests without known metadata) before deleting
        # anything. An incomplete dependency graph must never drive cleanup.
        manifest = command_json([
            "docker", "buildx", "imagetools", "inspect", "--raw", f"{package}@{digest}",
        ])
        if not isinstance(manifest, dict) or manifest.get("schemaVersion") != 2:
            raise ValueError(f"Unsupported manifest for {digest}")
        if media_type in INDEX_TYPES and not isinstance(manifest.get("manifests"), list):
            raise ValueError(f"Missing child manifests for {digest}")
        descriptors = manifest.get("manifests", [])
        if not isinstance(descriptors, list) or any(not isinstance(item, dict) for item in descriptors):
            raise ValueError(f"Invalid child manifests for {digest}")
        for descriptor in descriptors:
            child = descriptor.get("digest", "")
            if not DIGEST.fullmatch(child) or child not in records:
                raise ValueError(f"Child manifest {child!r} missing from the image list; retry cleanup later")
            children[digest].add(child)

    referenced = set().union(*children.values())
    roots = set(records) - referenced
    if not roots:
        raise ValueError("No top-level images found; refusing to prune")

    # Tags protect intentional releases and the currently pushed :latest image,
    # even when a reused digest has an older upload timestamp.
    tagged = {digest for digest, image in records.items() if image.get("tags")}
    latest = {digest for digest, image in records.items()
              if any(tag.rsplit(":", 1)[-1] == "latest" for tag in image.get("tags", []))}
    retained_roots = roots & latest
    for digest in sorted(roots, key=lambda item: (times[item], item), reverse=True):
        if len(retained_roots) >= keep:
            break
        retained_roots.add(digest)
    retained_roots |= roots & tagged
    protected = set()
    pending = list(retained_roots | tagged)
    while pending:
        digest = pending.pop()
        if digest in protected:
            continue
        protected.add(digest)
        pending.extend(children[digest])

    obsolete = set(records) - protected
    # Topological order, rather than upload time: indexes often upload AFTER
    # their children, and children can be shared between multiple indexes.
    incoming = {digest: 0 for digest in obsolete}
    for parent in obsolete:
        for child in children[parent] & obsolete:
            incoming[child] += 1
    ready = [(times[digest], digest) for digest, count in incoming.items() if count == 0]
    heapq.heapify(ready)
    order = []
    while ready:
        _, digest = heapq.heappop(ready)
        order.append(digest)
        for child in children[digest] & obsolete:
            incoming[child] -= 1
            if incoming[child] == 0:
                heapq.heappush(ready, (times[child], child))
    if len(order) != len(obsolete):
        raise ValueError("Cyclic manifest references; no images were deleted")

    print(f"    retaining {len(retained_roots)} complete images and {len(protected)} protected digests", flush=True)
    if not order:
        print("    nothing to prune")
        return
    for digest in order:
        if dry_run:
            print(f"    would delete {digest}")
            continue
        result = subprocess.run([
            "gcloud", "artifacts", "docker", "images", "delete", f"{package}@{digest}",
            "--quiet", "--delete-tags", f"--project={project}",
        ], text=True, capture_output=True)
        if result.returncode:
            # Do not call every reference failure a kept parent. A concurrent
            # push or a failed parent deletion requires a fresh graph.
            raise RuntimeError(f"Could not delete {digest}: {result.stderr.strip() or result.stdout.strip()}")
        print(f"    deleted {digest}", flush=True)
    print(f"    {'would prune' if dry_run else 'pruned'} {len(order)} obsolete digests", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package")
    parser.add_argument("--project", required=True)
    parser.add_argument("--keep", type=int, default=2)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.keep < 1:
        parser.error("--keep must be at least 1")
    try:
        prune(args.package, args.project, args.keep, args.dry_run)
    except (RuntimeError, ValueError, OSError) as error:
        print(f"Cleanup failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
