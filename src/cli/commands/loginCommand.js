const chalk = require('chalk');
const { exec } = require('child_process');
const http = require('http');
const { SERVER_URL, setToken } = require('../../utils/auth');

async function loginCommand() {
  console.log(chalk.cyan('Inicio de sesión en GitBrancher\n'));

  // Parse command line arguments for token
  const args = process.argv.slice(2);
  const tokenIndex = args.indexOf('--token');
  
  if (tokenIndex !== -1 && args[tokenIndex + 1]) {
    // Token provided as argument
    const token = args[tokenIndex + 1];
    setToken(token);
    console.log(chalk.green('✅ Token guardado exitosamente!'));
    console.log(chalk.white('Ahora puedes usar comandos que requieren autenticación.'));
    return;
  }

  // Crear servidor local temporal para recibir el token
  const PORT = 8765;
  let server;
  
  const serverPromise = new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      
      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        
        if (token) {
          // Guardar token
          setToken(token);
          
          // Responder al navegador con página de éxito
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Autenticación exitosa - GitBrancher</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                body {
                  background: rgb(255 240 223/1);
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
              </style>
            </head>
            <body class="antialiased">
              <div class="min-h-screen flex items-center justify-center px-8">
                <div class="bg-white p-8 rounded-lg shadow-lg max-w-md mx-auto text-center">
                  <div class="text-6xl mb-4">✅</div>
                  <h1 class="text-2xl font-bold text-gray-900 mb-4">¡Autenticación exitosa!</h1>
                  <p class="text-gray-600 mb-4">Ya puedes cerrar esta ventana y volver a tu terminal.</p>
                  <p class="text-gray-500 text-sm">GitBrancher CLI está listo para usar</p>
                </div>
              </div>
            </body>
            </html>
          `);
          
          // Resolver promesa y cerrar servidor
          setTimeout(() => {
            server.close();
            resolve(token);
          }, 1000);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Error - GitBrancher</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                body {
                  background: rgb(255 240 223/1);
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
              </style>
            </head>
            <body class="antialiased">
              <div class="min-h-screen flex items-center justify-center px-8">
                <div class="bg-white p-8 rounded-lg shadow-lg max-w-md mx-auto text-center">
                  <div class="text-6xl mb-4">❌</div>
                  <h1 class="text-2xl font-bold text-gray-900 mb-4">Error de autenticación</h1>
                  <p class="text-gray-600">No se recibió el token. Por favor, intenta nuevamente.</p>
                </div>
              </div>
            </body>
            </html>
          `);
          reject(new Error('Token no recibido'));
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(chalk.gray(`Servidor local iniciado en http://localhost:${PORT}`));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(chalk.red(`Puerto ${PORT} en uso. Intenta cerrar otras instancias de gitbrancher.`));
      }
      reject(err);
    });
  });

  // Abrir navegador con la página de login
  const loginUrl = `${SERVER_URL}/login?cli_callback=http://localhost:${PORT}/callback`;
  console.log(chalk.white('Abriendo navegador para iniciar sesión...'));
  console.log(chalk.gray('Esperando autenticación...\n'));

  try {
    // Abrir navegador usando comando del sistema
    const platform = process.platform;
    let openCommand;

    if (platform === 'darwin') {
      openCommand = `open "${loginUrl}"`;
    } else if (platform === 'win32') {
      openCommand = `start "" "${loginUrl}"`;
    } else {
      openCommand = `xdg-open "${loginUrl}"`;
    }

    exec(openCommand, (error) => {
      if (error) {
        console.log(chalk.red(`Error al abrir navegador: ${error.message}`));
        console.log(chalk.white('Visita manualmente: ') + chalk.cyan(loginUrl));
        if (server) server.close();
        return;
      }
    });

    // Esperar a recibir el token
    const token = await serverPromise;
    
    console.log(chalk.green('\n✅ Autenticación exitosa!'));
    console.log(chalk.white('Token guardado. Ahora puedes usar comandos que requieren autenticación.'));
    process.exit(0);

  } catch (error) {
    console.log(chalk.red(`\nError en autenticación: ${error.message}`));
    if (server) server.close();
    process.exit(1);
  }
}

module.exports = loginCommand;
