# Laboratorio 11: CloudFront, Lambda y API Gateway

Este laboratorio tiene como propósito publicar un sitio web que utiliza un backend serverless. Para ello se distribuirán los archivos del sitio mediante Amazon S3 y Amazon CloudFront, y se incorporará una función AWS Lambda que responderá solicitudes a través de Amazon API Gateway.

El sitio conserva la página de la Universidad de los Andes utilizada en el laboratorio anterior y agrega una consulta de una actividad universitaria ficticia. El HTML, la imagen, el JavaScript y el código Python se entregan preparados. El trabajo consiste en configurar los servicios, comprobar su funcionamiento por separado y completar su integración.

La actividad es autocontenida: se crearán todos los recursos necesarios y no se requiere conservar buckets, funciones ni otros recursos de laboratorios anteriores. No se utilizarán EC2, bases de datos ni dominios propios.

Las habilidades que se espera ejercitar en esta actividad son:

1. Distribuir un sitio por HTTPS mediante CloudFront, manteniendo privado el bucket S3
2. Configurar una función Lambda y reconocer el evento, el handler y su respuesta
3. Invocar una función mediante una Function URL
4. Publicar una ruta HTTP mediante API Gateway e integrarla con Lambda
5. Configurar CloudFront para distribuir archivos y dirigir solicitudes a una API bajo un mismo dominio
6. Utilizar CloudWatch para comprobar las ejecuciones y revisar los mensajes del backend
7. Eliminar los recursos utilizados

## Entorno de trabajo

Para desarrollar este laboratorio se requiere:

- Una cuenta AWS activa, con acceso mediante un usuario IAM administrador protegido con MFA
- Un computador con navegador y acceso al repositorio del laboratorio

La actividad se realiza desde la consola web de AWS, por lo que puede utilizarse cualquier computador con navegador, independientemente de su sistema operativo. No se requiere instalar Python, AWS CLI ni otras herramientas de desarrollo.

Se utilizará la consola de AWS en inglés y la región **South America (São Paulo), `sa-east-1`**, para S3, Lambda, API Gateway y CloudWatch. CloudFront es un servicio global y su consola no requiere seleccionar esa región. La función utilizará **Python 3.14**.

Los servicios pueden generar cargos. Se utilizará CloudFront con cobro por consumo (**Pay as you go**), sin contratar un plan mensual ni habilitar protecciones adicionales de AWS WAF. No se debe asumir que los créditos o beneficios de la cuenta cubren todo el consumo. La limpieza final forma parte del laboratorio.

## Preparación

El repositorio contiene:

```text
lab11/
├── README.md
├── website/
│   ├── index.html
│   ├── fic.webp
│   └── app.js
└── backend/
    └── lambda_function.py
```

- **`website/index.html`**: página de la Universidad de los Andes, con estilos incorporados y un formulario para consultar una actividad
- **`website/fic.webp`**: fotografía utilizada por la página
- **`website/app.js`**: código que consulta `/api/actividad` y presenta la respuesta en la página
- **`backend/lambda_function.py`**: handler en Python que responde con información de una actividad ficticia, un saludo y el identificador de la invocación

No se requiere descargar el repositorio completo ni modificar el código. Los archivos del sitio se descargarán individualmente al computador para cargarlos en S3. El código Python se copiará al editor de Lambda.

Al finalizar, las solicitudes seguirán este recorrido:

```text
Navegador → CloudFront ┬─ Archivos del sitio → S3 privado
                      └─ /api/actividad → API Gateway → Lambda
```

## Procedimiento

### 1. Preparar los archivos en S3

**Amazon S3** almacena archivos como objetos dentro de buckets. En esta actividad el bucket permanecerá privado: CloudFront tendrá permiso para leer los archivos, pero no se habilitará su lectura anónima directamente desde S3.

#### 1.1 Crear el bucket

1. Iniciar sesión en la consola de AWS con el usuario IAM y buscar **S3** en el buscador superior
2. Seleccionar **General purpose buckets** en el menú lateral y luego **Create bucket**
3. En **Bucket name**, ingresar `icc4203-lab11-<token>`, reemplazando `<token>` por una combinación aleatoria de seis letras minúsculas y números
4. Confirmar que **AWS Region** sea **South America (São Paulo), `sa-east-1`**
5. Mantener **ACLs disabled**, **Block all public access** habilitado, **Bucket Versioning: Disable** y el cifrado **SSE-S3**
6. Mantener las demás opciones por omisión y seleccionar **Create bucket**

El nombre no puede coincidir con el de otro bucket, aunque pertenezca a otra cuenta AWS. Si el nombre ya está ocupado, se debe cambiar el identificador agregado. No se debe habilitar **Static website hosting**: se utilizará S3 como origen de CloudFront, no su website endpoint.

#### 1.2 Cargar los archivos

1. Descargar [index.html](https://raw.githubusercontent.com/ICC4203-202620/lab11/main/website/index.html), [fic.webp](https://raw.githubusercontent.com/ICC4203-202620/lab11/main/website/fic.webp) y [app.js](https://raw.githubusercontent.com/ICC4203-202620/lab11/main/website/app.js): hacer clic derecho sobre cada enlace y seleccionar la opción del navegador para guardar el enlace como archivo
2. Comprobar dónde quedaron guardados y que conserven sus nombres y extensiones
3. Volver a **S3 → General purpose buckets**, buscar el bucket recién creado y seleccionar su nombre
4. En **Objects**, seleccionar **Upload → Add files** y agregar los tres archivos
5. Comprobar la lista, seleccionar **Upload** y esperar que finalice la carga; luego seleccionar **Close**
6. En **Objects**, seleccionar `index.html`; en **Properties**, copiar **Object URL**
7. Abrir esa URL en una ventana de incógnito y comprobar que responde **Access Denied**

Los tres archivos deben quedar directamente en la raíz del bucket, sin la carpeta `website/`. El acceso rechazado es el resultado esperado: la existencia de una URL no otorga permiso de lectura.

### 2. Publicar el sitio mediante CloudFront

**Amazon CloudFront** es una red de distribución de contenido o CDN. Recibe las solicitudes de los usuarios y puede responder con copias almacenadas en caché o consultar un origen para obtener el contenido. Una **distribución** define los orígenes, las reglas de entrega y el dominio por el cual se accederá al sitio.

#### 2.1 Crear la distribución

1. Buscar **CloudFront** en la consola de AWS y abrir el servicio
2. En **Distributions**, seleccionar **Create distribution**
3. Asignar el nombre `icc4203-lab11` y seleccionar **Single website or app**; si se solicita un plan, seleccionar **Pay as you go**
4. Omitir la configuración de un dominio propio; se utilizará el dominio que proporciona CloudFront
5. En **Origin type**, seleccionar **Amazon S3**
6. En **S3 origin**, utilizar **Browse S3** y seleccionar el bucket creado en el punto 1
7. Seleccionar **Use recommended origin settings**, que configura el acceso mediante **Origin Access Control (OAC)**
8. Continuar y, en la configuración de seguridad, seleccionar la opción que no habilita protecciones adicionales de **AWS WAF**
9. Revisar que el origen corresponda al bucket de esta actividad, que el plan sea **Pay as you go** y que no se haya habilitado AWS WAF; seleccionar **Create distribution**

**OAC** permite que CloudFront firme las solicitudes que envía a S3. Una política del bucket autoriza a esa distribución a leer los objetos. Esto permite entregar públicamente el sitio mediante CloudFront sin hacer público el bucket.

#### 2.2 Revisar el acceso al origen

1. En **CloudFront → Distributions**, seleccionar el ID de la distribución creada
2. Abrir **Origins**, seleccionar el origen S3 y revisar su configuración mediante **Edit**
3. Comprobar que utilice **Origin access control settings (recommended)** y registrar el nombre o identificador del OAC seleccionado; cerrar la edición sin modificarla
4. En el menú lateral de CloudFront, abrir **Origin access → Control settings**, seleccionar ese OAC y revisar mediante **Edit** que **Signing behavior** sea **Sign requests (recommended)**; conservar esa configuración
5. Abrir S3 en otra pestaña, seleccionar **General purpose buckets**, abrir el bucket y entrar a **Permissions**
6. Comprobar que **Block all public access** continúe habilitado y que **Bucket policy** permita a `cloudfront.amazonaws.com` realizar `s3:GetObject`, con una condición `AWS:SourceArn` que identifique la distribución creada

El asistente de CloudFront puede aplicar esta política automáticamente. Si la consola indica que falta actualizarla, volver a la configuración del origen en CloudFront, utilizar **Copy policy** y pegarla en **S3 → bucket → Permissions → Bucket policy → Edit**. Guardar la política sin desactivar el bloqueo de acceso público.

No corresponde utilizar una política con `"Principal": "*"` para publicar los objetos. El permiso debe estar asociado a la distribución de esta actividad.

#### 2.3 Configurar y comprobar la página inicial

1. Volver a la distribución en CloudFront y abrir **General**
2. En **Settings**, seleccionar **Edit**, escribir `index.html` en **Default root object**, sin una barra inicial, y guardar
3. Abrir **Behaviors**, seleccionar **Default (*)** y luego **Edit**
4. Configurar **Viewer protocol policy: Redirect HTTP to HTTPS** y **Allowed HTTP methods: GET, HEAD**
5. Mantener el origen S3 y seleccionar la política de caché administrada **CachingOptimized**; guardar los cambios
6. Esperar que **Last modified** deje de indicar **Deploying** y muestre una fecha y hora
7. En **General → Details**, copiar **Distribution domain name**, cuyo formato es similar a `d123456789.cloudfront.net`
8. Abrir `https://DOMINIO_CLOUDFRONT/`, reemplazando `DOMINIO_CLOUDFRONT` por el dominio copiado
9. Comprobar que aparecen la página, la fotografía y el formulario
10. Volver a abrir la **Object URL** de `index.html` en una ventana de incógnito y comprobar que el acceso directo a S3 sigue rechazado

El formulario todavía no puede completar la consulta porque aún no existe el backend. Si se utiliza en esta etapa, mostrará un mensaje de error.

La distribución puede tardar varios minutos en quedar disponible. Mientras se completa el despliegue se puede avanzar con la creación de Lambda y volver luego a esta comprobación.

### 3. Crear y probar la función Lambda

**AWS Lambda** ejecuta código cuando recibe una invocación, sin requerir la creación ni administración de un servidor. El **handler** es la función de entrada que recibe el evento y produce el resultado.

#### 3.1 Crear la función

1. Buscar **Lambda** en la consola y seleccionar la región **South America (São Paulo), `sa-east-1`**
2. Abrir la lista de funciones y seleccionar **Create function** o **Create Event Function**, según la versión de la consola; si se distinguen tipos de funciones, utilizar **Event Functions**
3. Seleccionar **Author from scratch** y configurar:

   | Campo | Valor |
   | --- | --- |
   | Function name | `icc4203-lab11-actividad` |
   | Runtime | Python 3.14 |
   | Architecture | x86_64 |
   | Permissions | Create a new role with basic Lambda permissions, o Create default role si aparece ese nombre |

4. Mantener las demás opciones por omisión y crear la función
5. En **Code**, abrir el archivo `lambda_function.py`
6. Abrir el [código provisto](backend/lambda_function.py) en el repositorio y copiar su contenido completo
7. Reemplazar el código inicial del editor de Lambda por el código provisto y seleccionar **Deploy**
8. En **Code → Runtime settings**, comprobar que **Handler** sea `lambda_function.lambda_handler`
9. En **Configuration → Permissions**, registrar el nombre del **Execution role** para identificarlo durante la limpieza

El rol de ejecución define qué acciones puede realizar la función en AWS. Para esta actividad solo necesita los permisos básicos para escribir sus registros en CloudWatch; no se le debe asignar `AdministratorAccess`.

#### 3.2 Ejecutar una prueba desde la consola

1. Abrir la pestaña **Test** de la función y crear un evento de prueba
2. Asignarle el nombre `consulta-actividad`, mantenerlo como privado y reemplazar el contenido del evento por:

   ```json
   {
     "queryStringParameters": {
       "nombre": "Camila"
     }
   }
   ```

3. Guardar el evento y seleccionar **Test**
4. Abrir los detalles del resultado y comprobar que la ejecución finalizó correctamente
5. Identificar `statusCode: 200`, el encabezado `Content-Type` y la cadena JSON contenida en `body`
6. Cambiar el valor del parámetro `nombre` a `Diego`, guardar y repetir la prueba; comprobar que cambia el saludo de la respuesta

El evento de prueba contiene solo el dato que utiliza este handler. Las invocaciones HTTP entregarán eventos con más campos. `event` contiene los datos de entrada y `context` contiene información de la ejecución, como `aws_request_id`.

El retorno tiene una estructura que permite expresar una respuesta HTTP. En esta prueba se observa el objeto completo; al invocar mediante una URL, el servicio utilizará `statusCode` y `headers` para construir la respuesta y entregará el contenido de `body` al cliente. El encabezado `Cache-Control: no-store` indica que la respuesta no debe almacenarse en caché.

#### 3.3 Revisar la ejecución en CloudWatch

**Amazon CloudWatch** permite consultar métricas y registros de ejecución. En Lambda, los mensajes escritos mediante `print` se envían a un grupo de registros asociado a la función.

1. En la función Lambda, abrir **Monitor** y seleccionar **View CloudWatch logs**
2. Comprobar que el grupo sea `/aws/lambda/icc4203-lab11-actividad`
3. Abrir el flujo de registros más reciente, identificado en la lista **Log streams**
4. Buscar el mensaje `Consulta de actividad:` y comparar su identificador con el campo `solicitud` de la respuesta

Los registros pueden tardar unos instantes en aparecer. Si la lista está vacía, actualizarla después de ejecutar nuevamente la prueba.

### 4. Invocar Lambda mediante una Function URL

Una **Function URL** proporciona una dirección HTTPS para invocar directamente una función Lambda. En esta etapa se habilitará acceso público, sin autenticación, únicamente para consultar los datos ficticios de la actividad.

1. Volver a **Lambda**, abrir `icc4203-lab11-actividad` y seleccionar **Configuration → Function URL**
2. Seleccionar **Create function URL**
3. En **Auth type**, seleccionar **NONE**; no habilitar CORS y mantener las demás opciones por omisión
4. Guardar la configuración; la consola configura la política necesaria para permitir la invocación pública
5. Copiar la **Function URL**, con formato `https://IDENTIFICADOR.lambda-url.sa-east-1.on.aws/`
6. Abrirla en una ventana de incógnito y comprobar que se recibe un JSON con el saludo `Hola, visitante`
7. Agregar `?nombre=Camila` al final de la URL y volver a abrirla
8. Comprobar que cambia el saludo y que ahora el navegador recibe directamente los datos de la actividad, no el objeto que contiene `statusCode` y `body`

No se está llamando a la función desde JavaScript de otro sitio, sino abriendo su URL directamente en el navegador. Por ello no es necesario configurar CORS para esta comprobación.

Conservar temporalmente la dirección para comparar este acceso con el de la siguiente etapa. No se debe incluir información privada en una función expuesta de esta forma.

### 5. Publicar la función mediante API Gateway

**Amazon API Gateway** recibe solicitudes HTTP y las dirige al backend configurado. Una **ruta** identifica un método y un camino, como `GET /api/actividad`. Una **integración** establece qué recurso atenderá esa ruta. Una **etapa** o *stage* permite publicar la API.

Se utilizará una **HTTP API** integrada directamente con la misma función Lambda. API Gateway no invocará su Function URL.

#### 5.1 Crear la HTTP API

1. Buscar **API Gateway** en la consola y confirmar la región **South America (São Paulo), `sa-east-1`**
2. Seleccionar **Create API** y, en **HTTP API**, seleccionar **Build**
3. En **Integrations**, seleccionar **Add integration → Lambda**
4. Seleccionar la región `sa-east-1` y la función `icc4203-lab11-actividad`
5. Asignar a la API el nombre `icc4203-lab11-api` y continuar
6. En la configuración de rutas, dejar una única ruta con **Method: GET**, **Resource path: /api/actividad** e integración con la función seleccionada; reemplazar la ruta que el asistente proponga por omisión
7. En la configuración de etapas, mantener **Stage name: $default** y **Auto-deploy** habilitado
8. Revisar y crear la API, permitiendo que la consola otorgue a API Gateway el permiso para invocar la función

En el menú de la API, abrir **Routes** y comprobar que aparezca `GET /api/actividad`. En **Integrations**, seleccionar esa ruta y abrir los detalles de su integración: debe utilizar la función `icc4203-lab11-actividad` y el formato de payload **2.0**. Mantener la ruta sin autorización y sin configurar CORS. Si la consola creó otra ruta, ajustar la configuración para conservar únicamente la indicada.

La etapa `$default` permite utilizar la dirección base de la API sin agregar un nombre de etapa a la URL. No debe confundirse con una ruta `$default`: en este laboratorio se define explícitamente `GET /api/actividad`.

#### 5.2 Comprobar la API

1. En el menú de la API, abrir **Stages** y seleccionar `$default`
2. Copiar **Invoke URL**, con formato `https://IDENTIFICADOR.execute-api.sa-east-1.amazonaws.com`; si termina con `/`, quitar esa barra antes de agregar el camino
3. Agregar `/api/actividad?nombre=Camila` y abrir la dirección completa en una ventana de incógnito
4. Comprobar que se obtiene la misma estructura de datos que mediante la Function URL
5. Cambiar el parámetro a `nombre=Diego` y comprobar que cambia el saludo
6. Abrir la dirección con `/api/no-existe` y comprobar que API Gateway responde que la ruta no fue encontrada

El permiso para que API Gateway invoque Lambda es distinto del rol de ejecución de la función. El primero autoriza la llamada; el segundo determina qué puede hacer el código una vez que está ejecutándose.

#### 5.3 Retirar el acceso directo mediante Function URL

1. Volver a **Lambda → icc4203-lab11-actividad → Configuration → Function URL**
2. Seleccionar **Delete** y confirmar la eliminación de la Function URL, sin eliminar la función
3. Abrir nuevamente la antigua Function URL y comprobar que ya no entrega la actividad
4. Volver a consultar `/api/actividad` mediante la **Invoke URL** de API Gateway y comprobar que continúa funcionando

Esta comprobación permite verificar que API Gateway invoca la función directamente y no depende de la Function URL.

Eliminar la Function URL no elimina las declaraciones de permisos asociadas a ella. Esas declaraciones no mantienen operativa la URL eliminada y desaparecerán al eliminar la función durante la limpieza final.

### 6. Integrar API Gateway con CloudFront

La distribución tendrá dos orígenes. S3 entregará los archivos del sitio y API Gateway atenderá las solicitudes cuyo camino comience con `/api/`. Un **comportamiento** o *behavior* de CloudFront selecciona el origen y las reglas que se aplican a las solicitudes que coinciden con un patrón.

#### 6.1 Agregar el origen de la API

1. Abrir **CloudFront → Distributions** y seleccionar la distribución `icc4203-lab11`
2. En **Origins**, seleccionar **Create origin**
3. En **Origin domain**, ingresar solo el dominio de la **Invoke URL** de API Gateway, por ejemplo `IDENTIFICADOR.execute-api.sa-east-1.amazonaws.com`, sin `https://` ni caminos
4. Seleccionar **HTTPS only** para la conexión con el origen y mantener el puerto **443**
5. Dejar **Origin path** vacío y asignar el nombre `lab11-api`
6. Mantener las demás opciones por omisión y crear el origen

No se debe agregar `/api` ni `$default` como Origin path. La solicitud ya incluirá `/api/actividad` y la etapa `$default` no requiere un prefijo.

#### 6.2 Crear el comportamiento para la API

1. En la distribución, abrir **Behaviors** y seleccionar **Create behavior**
2. Configurar:

   | Campo | Valor |
   | --- | --- |
   | Path pattern | `/api/*` |
   | Origin and origin groups | `lab11-api` |
   | Viewer protocol policy | Redirect HTTP to HTTPS |
   | Allowed HTTP methods | GET, HEAD |
   | Cache policy | CachingDisabled |
   | Origin request policy | AllViewerExceptHostHeader |

3. Mantener las demás opciones por omisión y crear el comportamiento
4. Comprobar que `/api/*` aparezca antes de **Default (*)**, que debe conservar el origen S3
5. Esperar que termine el despliegue de los cambios

**CachingDisabled** evita que CloudFront reutilice respuestas de esta API. **AllViewerExceptHostHeader** reenvía los parámetros de consulta, como `nombre`, y permite que CloudFront utilice el dominio de API Gateway en el encabezado `Host` enviado al origen.

El patrón `/api/*` selecciona el origen, pero no elimina `/api` del camino. Por ello la ruta configurada en API Gateway también es `/api/actividad`.

#### 6.3 Consultar el backend desde el sitio

1. Abrir `https://DOMINIO_CLOUDFRONT/api/actividad?nombre=Camila` y comprobar que devuelve los datos de la actividad
2. Volver a `https://DOMINIO_CLOUDFRONT/`
3. Escribir `Camila` en el formulario y seleccionar **Consultar actividad**
4. Comprobar que aparecen el saludo, el nombre de la actividad, el lugar, la descripción y el identificador de la solicitud
5. Cambiar el nombre a `Diego` y repetir la consulta; comprobar que se actualizan el saludo y el identificador
6. Consultar nuevamente sin cambiar el nombre y comprobar que el identificador vuelve a cambiar
7. Abrir las herramientas de desarrollo del navegador mediante **Inspeccionar**, entrar a **Red** (**Network**) y realizar otra consulta
8. Seleccionar la solicitud a `/api/actividad` y revisar que su URL utilice el mismo dominio de CloudFront que la página
9. Volver a **Lambda → icc4203-lab11-actividad → Monitor → View CloudWatch logs**, abrir el flujo más reciente y buscar el identificador de la última respuesta

La API responde con `Cache-Control: no-store` para que el navegador no conserve una copia de sus respuestas. Esta configuración y la política **CachingDisabled** de CloudFront permiten comprobar las invocaciones sin confundirlas con respuestas recuperadas desde alguna de esas cachés.

El JavaScript utiliza una dirección relativa, `/api/actividad`, sin incorporar dominios de Lambda ni de API Gateway. Para el navegador, la página y la API pertenecen al mismo origen; no se requiere habilitar CORS para esta integración.

La dirección propia de API Gateway continúa siendo pública. Incorporarla como origen de CloudFront no bloquea por sí solo su acceso directo.

## Verificación final

Antes de eliminar los recursos, comprobar:

- **Publicación del sitio**: la página y su fotografía se muestran por HTTPS mediante el dominio de CloudFront
- **Acceso al almacenamiento**: la Object URL de `index.html` sigue respondiendo **Access Denied**
- **Invocación del backend**: la ruta de API Gateway funciona después de eliminar la Function URL
- **Integración con la página**: el formulario consulta `/api/actividad` bajo el mismo dominio del sitio y presenta el nombre ingresado
- **Ejecuciones independientes**: dos consultas consecutivas producen identificadores distintos, que pueden localizarse en CloudWatch

Estas comprobaciones constituyen la evidencia de funcionamiento de la actividad. Las capturas, si se solicitan, no deben incluir contraseñas, códigos MFA ni credenciales de AWS.

Al finalizar se debe poder explicar:

1. ¿Por qué el sitio es público mediante CloudFront si el bucket continúa siendo privado?
2. ¿Qué cambia entre invocar Lambda desde la consola, mediante Function URL y mediante API Gateway?
3. ¿Cómo determina CloudFront si una solicitud debe dirigirse a S3 o a API Gateway?
4. ¿Por qué la página puede consultar la API sin configurar CORS?
5. ¿Qué se observaría en el identificador de solicitud si CloudFront reutilizara una respuesta anterior de la API?

## Problemas frecuentes

- **CloudFront responde Access Denied al abrir el sitio**: comprobar que terminó el despliegue, que `index.html` está en la raíz del bucket y que está configurado como Default root object, sin `/` inicial; revisar el OAC y la política del bucket sin hacer públicos los objetos
- **La página no muestra la fotografía o el formulario no responde**: revisar que `fic.webp` y `app.js` estén en la raíz del bucket y conserven sus nombres; comprobar sus solicitudes en la pestaña Red del navegador
- **Lambda informa que no encuentra el handler**: revisar el nombre `lambda_function.py`, el valor `lambda_function.lambda_handler` y que se haya seleccionado Deploy después de pegar el código
- **API Gateway responde Not Found**: revisar el método GET, el camino `/api/actividad`, la etapa `$default` y Auto-deploy; consultar solo la URL base no coincide con la ruta del laboratorio
- **API Gateway responde Internal Server Error**: probar la función desde Lambda y revisar CloudWatch; si la prueba funciona, revisar la integración y el permiso para que API Gateway invoque la función
- **La API funciona directamente, pero falla mediante CloudFront**: revisar el origen sin caminos, Origin path vacío, el comportamiento `/api/*` y la política AllViewerExceptHostHeader
- **La respuesta no refleja el nombre ingresado o repite el identificador**: comprobar que el comportamiento de la API utilice CachingDisabled y AllViewerExceptHostHeader, y esperar que termine el despliegue

Si CloudFront conserva una respuesta anterior después de corregir la configuración o un archivo, abrir la distribución, entrar a **Invalidations → Create invalidation**, indicar el camino afectado, como `/index.html` o `/api/actividad*`, y crear la invalidación. Esperar que su estado sea **Completed** antes de repetir la consulta en una nueva ventana de incógnito. La invalidación elimina la copia en CloudFront, no la que pudiera mantener el navegador. Las invalidaciones también pueden generar cargos.

Si un servicio presenta una interrupción, se pueden completar las comprobaciones independientes de S3, Lambda o API Gateway y retomar después la integración; no se debe considerar terminada la actividad sin esa comprobación.

## Limpieza de recursos

Eliminar únicamente los recursos creados durante esta actividad. No se requiere conservarlos para el laboratorio siguiente. El usuario IAM y sus dispositivos MFA deben mantenerse.

1. En **CloudFront → Distributions**, abrir la distribución de la actividad y registrar el identificador del OAC utilizado por su origen S3
2. Volver a la lista de distribuciones, seleccionar la distribución de la actividad y utilizar **Disable**; confirmar
3. Esperar que **Last modified** deje de indicar **Deploying**, comprobar que el estado sea **Disabled** y seleccionar **Delete**; confirmar la eliminación
4. En el menú de CloudFront, abrir **Origin access → Control settings**, identificar el OAC registrado y eliminarlo una vez que ya no esté asociado a la distribución
5. Abrir **API Gateway** en `sa-east-1`, seleccionar `icc4203-lab11-api` en la lista de APIs y utilizar **Actions → Delete**; confirmar el nombre
6. Abrir **Lambda**, seleccionar `icc4203-lab11-actividad` y registrar nuevamente el nombre de su rol en **Configuration → Permissions**
7. Volver a la lista de funciones, seleccionar la función y utilizar **Actions → Delete**; confirmar
8. Abrir **CloudWatch → Logs → Log groups** en `sa-east-1`, seleccionar `/aws/lambda/icc4203-lab11-actividad` y eliminarlo mediante **Actions → Delete log group(s)**
9. Abrir **IAM → Roles**, buscar el nombre exacto del rol registrado y abrirlo; en **Permissions**, registrar el nombre de cualquier política **Customer managed** creada exclusivamente para esta función, si existe
10. Volver a la lista de roles, seleccionar el rol registrado y eliminarlo; no eliminar el usuario IAM ni roles de otras actividades
11. Si se registró una política propia, abrir **IAM → Policies**, buscarla y comprobar en **Entities attached** que no esté asociada a otros usuarios, grupos ni roles; solo en ese caso eliminarla mediante **Actions → Delete**. No se deben eliminar políticas **AWS managed**
12. Abrir **S3 → General purpose buckets**, seleccionar el bucket del laboratorio y utilizar **Empty**; comprobar su nombre y confirmar
13. Volver a la lista de buckets, seleccionar ese mismo bucket y utilizar **Delete**; confirmar su nombre
14. Comprobar que no queden la distribución, el OAC, la API, la función, su grupo de registros, su rol, sus posibles políticas propias ni el bucket; luego cerrar la sesión de la consola

La distribución debe eliminarse antes que el bucket utilizado como origen. Desactivar CloudFront y esperar la propagación de ese cambio puede tomar varios minutos; cerrar la consola no reemplaza esta limpieza.
