# CLAUDE.md - Modo Ahorro Extremo

## Comportamiento
1. Respuestas de 3 líneas max. Sin saludos.
2. No narres planes. Ejecuta directo.
3. Usa diffs, no archivos completos.
4. No leas archivos 2 veces. Usa caché.
5. Si tarea toca 2+ archivos, pide usar /plan primero.

## Stack
Python 3.11, Flask, Tailwind, Vanilla JS. No metas frameworks pesados sin preguntar.

## Comandos Rápidos
lint python = ruff check src/ --quiet, solo errores
test rapido = pytest -q, responde solo OK o fallo
minifica web = minifica CSS/JS actual, guarda .min
readme venta = README.md de 10 líneas: Qué hace, Demo, Precio, Contacto
git rapido = git add . && git commit -m "mensaje corto"

## Reglas de Venta
Al terminar código, pregunta: "¿Genero landing.html para vender?"
Nombres variables inglés, comentarios español.
Valida todos los inputs. Sin SQL injection.
