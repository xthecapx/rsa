# El Campus Cuántico no tiene una entrada claramente descubrible
Después de completar los cuatro retos, el profesor recomienda “visitar el campus”, pero en Pueblo cuantico no aparece un boton o camino claramente identificado(o al menos yo no lo encontre), para hacerlo.
         
La única ruta que encontré fue:
1. Abrir Guardar progreso.
2. Localizar “Campus Cuántico · atajos independientes”.
3. Seleccionar qc1 · Llegada al campus.

Esto funciona, pero no hace parte como de navegación normal.

## Recomendación: 

Creo que se puede añadir “Ir al Campus Cuántico” a la guía del profesor y explicar que es una ruta. independiente.

# Simulaciones lentas y un timeout
En varias ocasiones encontre algunos casos donde hubo timeouts, puede ser por temas del server, pero basicamente me encontre lo siguiente:

- Una primera ejecución de circuito vacío terminó con signal timed out después de más de 20 segundos.
- Muchas ejecuciones pequeñas tardaron entre 6 y 12 segundos.
- En el Campus, varias ejecuciones de solo 16 muestras tardaron entre 22 y 24 segundos.
- Durante la ejecución, casi todos los controles quedan deshabilitados y no hay botón de cancelar.

## Recomendación:
- Se podria mostrar fases de progreso: cola, envío, simulación, postprocesamiento.
- Añadir un boton de cancelar y reintentar.
- Mantener un timeout explícito con mensaje comprensible.
- Cachear circuitos didácticos pequeños, ya que vi que habian cosas que se podrian cachear para mejorar la experiencia ya que note que se accedia varias veces al mismo recurso desde 0, cuando podria ser cacheado
- Separar latencia del backend de tiempo de renderizado, aunque no se que tan viable sea, la verdad no soy experto en videojuegos.

# El resultado de Grover queda desactualizado al cambiar rondas
Después de ejecutar cuatro rondas, seleccionar tres cambia el encabezado del circuito, pero el gráfico anterior permanece visible hasta volver a ejecutar. Esto creo que es un problema de estado, pero fui capaz de replicarlo varias veces.

## Recomendación: 
Se podria marcar el resultado como “corresponde a la configuración anterior”, atenuarlo o borrarlo inmediatamente.

# Falta autenticación de claves públicas
El juego ofrece como alternativa sospechosa sustituir la clave pública por la del jugador, pero no aprovecha el momento para explicar que el cifrado RSA no autentica por sí solo al propietario de una clave. Esto creo que podria ser una mejora mas narrativa por que creo que es una buena oportunidad para explicar diferentes conceptos alrededor.

## Recomendación: 
Añadir una nota sobre certificados, firmas o canales autenticados. Esto convertiría una decisión narrativa en una excelente introducción a ataques de intermediario.

# RSA de libro de texto sin contexto sobre codificación y relleno
Yo aca no estoy muy seguro, por que puede que haya sido hecho intencionalmente asi, pero la representación letra -> número es adecuada en el contexto de juego, pero debería creo que advertirse que RSA real no cifra letras directamente y que utiliza esquemas de codificación como OAEP. Entiendo que el RFC 8017 recomienda RSAES-OAEP para aplicaciones nuevas.

Con respecto al ultimo y ahi si juego mi carta de ignorante, pero claramente con AI iba revisando conceptos que me interesaban y queria profundizar. Dicho esto, creo que vale la pena terminar con una breve introducción a la migración poscuántica:. Segun estuve mirando y leyendo al respecto NIST finalizó ML-KEM, ML-DSA y SLH-DSA en 2024 y recomienda inventariar y migrar sistemas vulnerables antes de que exista una computadora cuántica criptográficamente relevante, aunque seguramente tu sabras mas de ello, pero creo que seria un contenido interesante de ver.

# Los controles de movimiento y el foco compiten
Este es mas como de accesibilidad pero me paso que si el foco queda en “Minimapa del pueblo”, pulsar W no mueve al personaje ya que el foco visual permanece en el botón. El canvas tampoco tiene un punto de foco evidente.

## Recomendación:
- Se poria crear un área de juego enfocable con nombre accesible.
- Creo que si se puede se podria explicar cómo devolver el foco al movimiento.
- Evitar capturar WASD mientras el usuario está escribiendo en un campo. Esto creo que seria el fix
- Ofrecer destinos navegables por teclado como complemento al canvas, aunque ya eso seria mas a11y.

# Los 256 conteos de Shor saturan el árbol accesible
Este parce es de a11y, pero me paso que la ejecución de ocho bits expone cada cadena y su conteo. Me dio por poner un lector de pantalla y recorrer 256 elementos resulto excesivo.

## Recomendación: 
Creo que se podria mostrar por defecto los picos principales y un resumen estadístico, con “Ver todos los conteos” como región expandible o tabla virtualizada. Aunque de nuevo, este lo encontre revisando ese detalle que no se inicialmente si sea muy relevante

# Mezcla de español e inglés
Me encontre unos problemitas menores con los textos, no se la verdad si hay mas, pero estos son los que pude ver:
- Backend agrees: m=...
- Measure -> Classical PC: counts
- reconstruida mediante hand
- “palabra en inglés” para CAFE
- “Elegiste la palabra en inglés”
- Un complemento paral portátil

# Notas con variables filtradas o mal etiquetadas
Aca si es mejor que corrbores, por que no estoy 100% seguro de si estoy correcto, pero me encontre con esto:
- En el acto de texto claro apareció k=20 sin contexto.
- En RSA apareció k=12, aparentemente donde se esperaba φ(N)=12.

Algunas notas persistieron entre actos, pero eso fue lo que me hizo dudar.

## Recomendación: 
Aca vale la pena usar nombres matemáticos completos y aislar el estado de notas de cada acto.

# Y por ultimo unos nitpicks que tengo en mis notas:
Estos no se si realmente se escriben asi, pero no tengo ni idea, yo no se escribir y las tildes que pongo son las automaticas jajajaja asi que hechales un ojo:
- “1 cúbits” y “1 ejecuciones”.
- “Escáner de el portátil”.
- “Cierral portátil”.

Otros detallitos, por ejemplo:
- En Forja, una instrucción dice volver a Pueblo cuántico cuando corresponde Pueblo Forja.
- El texto con efecto de máquina de escribir queda temporalmente cortado. Existe “Mostrar texto”, pero no siempre es evidente.
- El minimapa ocupa parte importante del terreno e intercepta clics mientras está expandido.
- Tras completar el festival, una leyenda visual seguía mostrando F · Festival ?, aunque el estado accesible ya indicaba “Completado”.
- Algunos controles tienen nombres accesibles duplicados, por ejemplo varias H.
- La advertencia de consola Excalibur was unable to unlock the audio context sugiere que el sonido puede no reproducirse aunque la interfaz diga “Sonido activado”.
- También aparecen advertencias de actualización/dibujo de escena antes de la inicialización.
