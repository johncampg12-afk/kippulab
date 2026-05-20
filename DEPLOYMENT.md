# Guía de Despliegue en Producción (Cloud Run & Cloudflare)

¡Tu aplicación KipuLab está lista para producción! Aquí te explicamos los pasos exactos para desplegar tu SaaS en Google Cloud Run y conectar tu dominio \`kippulab.com\` a través de Cloudflare.

## 1. Despliegue en Google Cloud Run

Dado que ya tienes configurados correctamente los scripts de producción en el archivo \`package.json\` (\`build\` con \`esbuild\` compila a un solo archivo optimizado y \`start\` ejecuta nativamente en Node.js), la aplicación funcionará de forma natural en Cloud Run.

Puedes desplegarla utilizando la GCloud CLI desde tu terminal:

\`\`\`bash
# 1. Asegúrate de tener instalado el SDK de Google Cloud
# 2. Inicia sesión
gcloud auth login

# 3. Configura tu proyecto de Google Cloud
gcloud config set project TU_ID_DE_PROYECTO

# 4. Despliega usando Cloud Build y Cloud Run (recomendado para Node.js)
gcloud run deploy kipulab-saas \\
  --source . \\
  --platform managed \\
  --region us-central1 \\
  --allow-unauthenticated \\
  --port 3000 \\
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=tu_clave_gemini,STRIPE_SECRET_KEY=tu_clave_stripe,SMTP_USER=tu_correo,SMTP_PASS=tu_clave_correo"
\`\`\`

> **Nota:** También puedes exportar el proyecto desde AI Studio haciendo clic en Exportar -> GitHub, y luego conectar tu repositorio de GitHub directamente a **Google Cloud Run** para habilitar CI/CD automático.

## 2. Configurar Cloudflare (DNS, WAF, SSL)

Una vez que Google Cloud Run termine de desplegar la aplicación, te entregará una URL (ej. \`https://kipulab-saas-...-uc.a.run.app\`). Para asegurar \`kippulab.com\` y habilitar el Web Application Firewall (WAF) de Cloudflare, sigue estos pasos:

### 2.1 Agregar Dominio en Google Cloud
1. Entra a "Cloud Run" en tu consola de Google Cloud.
2. Selecciona "Mapear dominios personalizados" (Domain mappings).
3. Añade el mapeo para \`kippulab.com\` y \`www.kippulab.com\` apuntando a tu servicio.
4. Google Cloud te proporcionará un registro **CNAME** o un registro **A/AAAA/TXT**.

### 2.2 Configurar DNS en Cloudflare
1. Inicia sesión en Cloudflare y selecciona tu dominio \`kippulab.com\`.
2. Ve a la pestaña **DNS**.
3. Añade los registros que te proporcionó Google Cloud.
4. Asegúrate de activar la nube naranja ☁️ (Proxy mode) para que Cloudflare intercepte el tráfico, aplicando el SSL y las reglas del WAF.

### 2.3 Seguridad y Reglas Strict WAF (Cloudflare)
1. **SSL/TLS Strict:** Ve a la pestaña SSL/TLS en Cloudflare y selecciona el modo **Full (Strict)**. Esto exige que tanto el cliente como Cloudflare, y Cloudflare y Google Cloud usen certificados válidos.
2. **WAF:** Ve a Seguridad -> WAF. Puedes agregar reglas, como por ejemplo:
   - Desafiar (Challenge) o bloquear (Block) tráfico de países fuera de tu área de servicio (Ecuador/LATAM).
   - Activar el Bot Fight Mode.
   - Mitigación de capa 7 para posibles ataques DDoS en \`/api/sri-sign\`.
3. **Redirección de HTTP a HTTPS:** En la pestaña Edge Certificates de SSL/TLS, activa "Always Use HTTPS" para proteger toda la transaccionalidad SaaS.

## 3. Webhooks de Stripe (Crítico para Facturación)

No olvides configurar el Webhook de Stripe en tu panel de desarrollador de Stripe para que apunte a producción:
- Endpoint: \`https://kippulab.com/api/webhook\` (Una vez lo implementes para capturar éxito de suscripción).
- Registra la **Stripe Webhook Secret** como variable de entorno en tu Google Cloud Run y añádela al código backend.
