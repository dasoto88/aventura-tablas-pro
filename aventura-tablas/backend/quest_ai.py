"""
Quest Escolar — Módulo IA con Groq (100% gratuito, sin tarjeta de crédito)
Extrae texto de PDFs/imágenes y genera preguntas educativas para primaria.
Groq free tier: 14,400 requests/día, super rápido.
"""
import os
import json
import base64
import re
from pathlib import Path

try:
    from groq import Groq
    GROQ_DISPONIBLE = True
except ImportError:
    GROQ_DISPONIBLE = False

# Para extraer texto de PDFs sin IA
try:
    import PyPDF2
    import io
    PDF_DISPONIBLE = True
except ImportError:
    PDF_DISPONIBLE = False

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Modelos disponibles en Groq free tier
MODELO_TEXTO    = "llama-3.3-70b-versatile"   # Para generar preguntas (muy bueno)
MODELO_VISION   = "meta-llama/llama-4-scout-17b-16e-instruct"  # Para leer imágenes


def _cliente():
    """Retorna cliente Groq configurado."""
    if not GROQ_DISPONIBLE:
        raise ValueError("groq no instalado. Ejecuta: pip install groq")
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY no configurada en las variables de entorno")
    return Groq(api_key=GROQ_API_KEY)


def extraer_texto_pdf(pdf_bytes: bytes) -> str:
    """
    Extrae texto de un PDF.
    Primero intenta extracción directa (PyPDF2), si falla usa Groq Vision.
    """
    # Método 1: Extracción directa (más rápido, sin IA)
    if PDF_DISPONIBLE:
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            texto = ""
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    texto += t + "\n"
            if texto.strip() and len(texto.strip()) > 50:
                return texto.strip()
        except Exception:
            pass

    # Método 2: Groq Vision (para PDFs escaneados o con imágenes)
    return extraer_texto_imagen(pdf_bytes, "image/jpeg")


def extraer_texto_imagen(imagen_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Extrae texto de una imagen (foto de guía de estudio) usando Groq Vision.
    Soporta: image/jpeg, image/png, image/webp
    """
    cliente = _cliente()
    img_b64 = base64.b64encode(imagen_bytes).decode("utf-8")

    # Asegurar formato correcto del mime_type
    if "pdf" in mime_type:
        mime_type = "image/jpeg"

    respuesta = cliente.chat.completions.create(
        model=MODELO_VISION,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime_type};base64,{img_b64}"}
                },
                {
                    "type": "text",
                    "text": (
                        "Esta es una foto o imagen de una guía de estudio escolar para niños de primaria. "
                        "Extrae TODO el texto que puedas leer en la imagen de forma precisa. "
                        "Mantén la estructura: títulos, subtítulos, preguntas, listas, párrafos. "
                        "Si hay texto ilegible escribe [ilegible]. "
                        "Solo devuelve el texto extraído, sin comentarios adicionales."
                    )
                }
            ]
        }],
        max_tokens=4096,
        temperature=0.1,
    )
    return respuesta.choices[0].message.content.strip()


def generar_plan_estudio(texto: str, dias: int = 5, materia: str = "", nivel: str = "primaria") -> dict:
    """
    Dado el texto de una guía, genera un plan de estudio dividido en días
    con preguntas para cada día. Retorna JSON estructurado.
    """
    cliente = _cliente()

    prompt = f"""Eres un maestro experto en educación primaria ({nivel}).
Tu tarea es crear un plan de estudio para un niño de 6-12 años a partir de este contenido de guía escolar.

CONTENIDO DE LA GUÍA:
---
{texto[:6000]}
---

INSTRUCCIONES:
1. Divide el contenido en exactamente {dias} partes (una para cada día de estudio)
2. Para CADA día genera exactamente 10 preguntas variadas:
   - 6 preguntas de opción múltiple (4 opciones: a, b, c, d)
   - 2 preguntas de verdadero o falso (opcion_a = "Verdadero", opcion_b = "Falso", opcion_c = "No sé", opcion_d = "")
   - 2 preguntas de completar el espacio (opcion_a = respuesta correcta, opcion_b y opcion_c = distractores, opcion_d = "")
3. Usa lenguaje SIMPLE y DIVERTIDO para niños de primaria
4. Las preguntas deben ser claras y directas
5. Incluye una explicación corta de por qué cada respuesta es correcta
6. Materia: {materia if materia else 'detectar automáticamente del contenido'}

RESPONDE ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto antes ni después):
{{
  "titulo": "Título de la guía",
  "materia": "Nombre de la materia",
  "resumen_general": "Breve descripción de lo que aprenderá el niño en 1-2 oraciones",
  "dias": [
    {{
      "dia": 1,
      "titulo": "Tema del Día 1",
      "resumen": "Resumen del contenido del día en 2-3 oraciones simples para niños",
      "conceptos_clave": ["concepto1", "concepto2", "concepto3"],
      "preguntas": [
        {{
          "tipo": "opcion_multiple",
          "pregunta": "¿Pregunta aquí?",
          "opcion_a": "Primera opción",
          "opcion_b": "Segunda opción",
          "opcion_c": "Tercera opción",
          "opcion_d": "Cuarta opción",
          "respuesta_correcta": "a",
          "explicacion": "Porque...",
          "dificultad": 1
        }}
      ]
    }}
  ]
}}"""

    respuesta = cliente.chat.completions.create(
        model=MODELO_TEXTO,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8192,
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    texto_respuesta = respuesta.choices[0].message.content.strip()

    # Limpiar marcadores de código si los hay
    texto_respuesta = re.sub(r'^```json\s*', '', texto_respuesta)
    texto_respuesta = re.sub(r'^```\s*', '', texto_respuesta)
    texto_respuesta = re.sub(r'\s*```$', '', texto_respuesta)

    try:
        data = json.loads(texto_respuesta)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]+\}', texto_respuesta)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError(f"Groq no retornó JSON válido: {texto_respuesta[:300]}")

    if "dias" not in data:
        raise ValueError("Respuesta de Groq sin campo 'dias'")

    return data


def generar_resumen_dia(texto_dia: str, nombre_alumno: str = "amigo") -> str:
    """
    Genera un resumen interactivo y divertido del contenido del día.
    """
    cliente = _cliente()

    respuesta = cliente.chat.completions.create(
        model=MODELO_TEXTO,
        messages=[{
            "role": "user",
            "content": f"""Eres un maestro súper divertido que le explica a {nombre_alumno} el siguiente tema escolar.

CONTENIDO:
{texto_dia[:2000]}

INSTRUCCIONES:
- Explica el tema de forma divertida y simple para un niño de primaria
- Usa emojis para hacer el texto más visual
- Divide en 3-5 puntos clave con títulos llamativos
- Usa ejemplos de la vida cotidiana de los niños
- Máximo 250 palabras
- Termina con una frase motivacional corta

Responde solo con el texto explicativo."""
        }],
        max_tokens=1024,
        temperature=0.5,
    )
    return respuesta.choices[0].message.content.strip()


def validar_configuracion() -> dict:
    """Verifica que Groq esté configurado correctamente."""
    if not GROQ_DISPONIBLE:
        return {"ok": False, "error": "Librería 'groq' no instalada. Ejecuta: pip install groq"}
    if not GROQ_API_KEY:
        return {"ok": False, "error": "GROQ_API_KEY no está configurada en las variables de entorno"}
    try:
        cliente = _cliente()
        resp = cliente.chat.completions.create(
            model=MODELO_TEXTO,
            messages=[{"role": "user", "content": "Responde solo la palabra: OK"}],
            max_tokens=10,
        )
        texto = resp.choices[0].message.content.strip()
        if texto:
            return {"ok": True, "modelo": MODELO_TEXTO, "respuesta": texto}
        return {"ok": False, "error": "Respuesta vacía de Groq"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
