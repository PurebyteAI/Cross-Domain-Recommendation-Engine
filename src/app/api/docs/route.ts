import { NextResponse } from 'next/server'

/**
 * GET /api/docs
 * Serve API documentation with Swagger UI
 */
export async function GET() {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://api.recommendation-engine.com'
    : 'http://localhost:3000'

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TasteSync API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #312e81 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
        }
        .swagger-ui {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .swagger-ui .topbar {
            background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%);
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .swagger-ui .topbar .download-url-wrapper {
            display: none;
        }
        .header {
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(10px);
            padding: 20px;
            text-align: center;
            margin-bottom: 30px;
            border-radius: 12px;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .header h1 {
            color: #60a5fa;
            margin: 0 0 10px 0;
            font-size: 2.5rem;
            font-weight: bold;
            background: linear-gradient(135deg, #60a5fa 0%, #34d399 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .header p {
            color: #cbd5e1;
            margin: 0;
            font-size: 1.1rem;
        }
        .swagger-ui .info {
            background: rgba(15, 23, 42, 0.8);
            border-radius: 8px;
            padding: 20px;
            border: 1px solid rgba(59, 130, 246, 0.2);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 TasteSync API Documentation</h1>
        <p>Cross-Domain Recommendation Engine - AI-Powered Cultural Intelligence</p>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: '${baseUrl}/api/docs/openapi',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                theme: "dark",
                tryItOutEnabled: true,
                requestInterceptor: (request) => {
                    // Add authentication if needed
                    return request;
                },
                responseInterceptor: (response) => {
                    return response;
                }
            });
        };
    </script>
</body>
</html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  })
}
