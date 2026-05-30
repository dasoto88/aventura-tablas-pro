from flask import Flask

app = Flask(__name__)

# Ruta principal
@app.route("/")
def index():
    return "<h1>Hola Mundo 🌎</h1>"

if __name__ == "__main__":
    app.run(debug=True)
