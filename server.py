import os, http.server, socketserver

port = int(os.environ.get('PORT', 8080))

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

with socketserver.TCPServer(('', port), Handler) as httpd:
    print(f'Servidor em http://localhost:{port}')
    httpd.serve_forever()
