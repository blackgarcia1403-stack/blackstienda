# BLACKS — Tienda DTF (edición gratuita para Netlify)

Esta versión está preparada para publicarse en el plan **Netlify Free**. Incluye catálogo público, panel privado para que solo el administrador publique/elimine diseños, y MAKEUP / Vista previa.

## Lo que conserva

- Identidad visual BLACKS, colores negro/rojo/blanco y logotipo.
- Catálogo público por categorías.
- Acceso de administrador protegido por contraseña.
- Carga y eliminación privada de diseños.
- Los diseños del catálogo y sus imágenes se guardan en **Netlify Blobs**, no en el disco temporal de la función.
- MAKEUP permite al cliente cargar una imagen, elegir color/talla/frente/espalda y generar una simulación local de la playera.
- Pedidos por WhatsApp al 775 107 4289.

La vista previa es una simulación orientativa: no garantiza el tamaño, el color, la textura ni el resultado físico exacto de la impresión.

## Publicar gratis en Netlify

1. Descomprime este ZIP en tu computadora.
2. Entra a tu repositorio GitHub `BLACKS-TIENDA`.
3. Selecciona **Add file → Upload files**.
4. Arrastra el contenido de esta carpeta al repositorio (no subas el ZIP). Asegúrate de que `netlify.toml`, `package.json`, `public/` y `netlify/functions/api.js` queden en la raíz/rutas indicadas.
5. Escribe un mensaje como `Adaptar BLACKS a Netlify gratis` y pulsa **Commit changes**.
6. Crea una cuenta en [Netlify](https://app.netlify.com/) y elige el plan **Free**.
7. En Netlify pulsa **Add new project → Import an existing project → GitHub**.
8. Autoriza GitHub y selecciona `BLACKS-TIENDA`.
9. Configuración de build:
   - Build command: `npm install` (o deja que Netlify detecte `netlify.toml`).
   - Publish directory: `public`.
   - Functions directory: `netlify/functions` (lo toma de `netlify.toml`).
10. Antes de publicar, abre **Project configuration → Environment variables** y agrega:
    - `ADMIN_PASSWORD`: una contraseña privada tuya, de al menos 10 caracteres.
    - `SESSION_SECRET`: una clave aleatoria larga de al menos 32 caracteres. Puedes generar una en PowerShell con: `-join ((1..48 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))`
11. Guarda las variables y ejecuta **Deploy**. Si modificas las variables después del primer deploy, vuelve a desplegar para que se apliquen.
12. Cuando el estado sea **Published**, Netlify mostrará una dirección gratuita terminada en `.netlify.app`.

## Límites del plan gratuito

Netlify Free incluye un límite mensual de uso (actualmente 300 créditos). La cuenta no recibe cobros automáticos por exceder el límite del plan gratuito: al alcanzar el límite, los sitios se pausan hasta el siguiente ciclo o hasta cambiar de plan. El plan ofrece funciones y almacenamiento de archivos Blobs, sujetos a los límites de uso publicados por Netlify. Revisa el consumo en el panel para evitar interrupciones.

La dirección `.netlify.app` es gratuita. Un dominio propio como `blacks.com` normalmente se compra aparte.

## Seguridad y archivos

- No guardes `ADMIN_PASSWORD` ni `SESSION_SECRET` en GitHub ni los compartas por mensaje.
- El acceso de administrador utiliza una cookie firmada, `HttpOnly`, `Secure` y `SameSite=Lax`.
- Las rutas de publicación y eliminación requieren autenticación.
- Las imágenes del catálogo se limitan a JPG, PNG o WEBP, máximo 4 MB por archivo, debido al tamaño máximo de las solicitudes síncronas de funciones.
- La imagen que el cliente sube en MAKEUP se procesa en su navegador y no se publica automáticamente.
- Haz copias de seguridad periódicas de tus archivos de catálogo. Netlify Blobs no sustituye una estrategia de respaldo independiente.

## Probar localmente

Para la vista local clásica con Express en `server.js`:

1. Instala Node.js 20 o superior.
2. Copia `.env.example` como `.env` y define `ADMIN_PASSWORD` y `SESSION_SECRET`.
3. Ejecuta `npm install` y `npm start`.
4. Abre `http://localhost:3000`.

El almacenamiento persistente Netlify Blobs funciona al ejecutar la app como una Netlify Function desplegada en Netlify. Para probar las funciones localmente se recomienda instalar Netlify CLI y ejecutar `netlify dev` con las variables de entorno configuradas.
