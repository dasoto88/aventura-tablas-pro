"""
Quest Escolar — Módulo IA con Google Gemini 1.5 Flash (gratuito)
Extrae texto de PDFs/imágenes y genera preguntas educativas para niños de primaria.
"""
import os
import json
import base64
import re
import google.generativeai as genai
from pathlib import Path

# Configurar Gemini con API key de variable de entorno
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-1.5-flash"  # Gratuito: 15 RPM, 1M TPM


def _get_model():
    """Retorna instancia del modelo Gemini."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY no configurada. Agrega al .env")
    return genai.GenerativeModel(MODEL_NAME)


def extraer_texto_pdf(pdf_bytes: bytes) -> str:
    """
    Extrae texto de un PDF usando Gemini Vision.
    Convierte el PDF a base64 y se lo pasa directamente al modelo.
    """
    model = _get_model()
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    prompt = (
        "Extrae TODO el texto de este documento PDF tal como aparece. "
        "Mantén la estructura: títulos, subtítulos, listas y párrafos. "
        "No agregues comentarios ni explicaciones. Solo el texto extraído."
    )

    response = model.generate_content([
        {"mime_type": "application/pdf", "data": pdf_b64},
        prompt
    ])
    return response.text.strip()


def extraer_texto_imagen(imagen_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Extrae texto de una imagen (foto de guía de estudio) usando Gemini Vision.
    mime_type puede ser: image/jpeg, image/png, image/webp
    """
    model = _get_model()
    img_b64 = base64.b64encode(imagen_bytes).decode("utf-8")

    prompt = (
        "Esta es una foto de una guía de estudio escolar. "
        "Extrae TODO el texto que puedas leer en la imagen. "
        "Mantén la estructura: títulos, subtítulos, preguntas, listas. "
        "Si hay texto ilegible escribe [ilegible]. Solo el texto, sin comentarios."
    )

    response = model.generate_content([
        {"mime_type": mime_type, "data": img_b64},
        prompt
    ])
    return response.text.strip()


def generar_plan_estudio(texto: str, dias: int = 5, materia: str = "", nivel: str = "primaria") -> dict:
    """
    Dado el texto de una guía, genera un plan de estudio dividido en días
    con preguntas para cada día. Retorna JSON estructurado.

    Estructura retornada:
    {
      "titulo": "...",
      "materia": "...",
      "resumen_general": "...",
      "dias": [
        {
          "dia": 1,
          "titulo": "Nombre del tema del día",
          "resumen": "Resumen del contenido (2-3 oraciones simples)",
          "conceptos_clave": ["concepto1", "concepto2"],
          "preguntas": [
            {
              "tipo": "opcion_multiple",
              "pregunta": "¿..?",
              "opcion_a": "...",
              "opcion_b": "...",
              "opcion_c": "...",
              "opcion_d": "...",
              "respuesta_correcta": "a",
              "explicacion": "Porque...",
              "dificultad": 1
            },
            ...10 preguntas por día...
          ]
        },
        ...
      ]
    }
    """
    model = _get_model()

    prompt = f"""Eres un maestro experto en educación primaria ({nivel}).
Tu tarea es crear un plan de estudio para un niño de 6-12 años a partir de este contenido de guía escolar.

CONTENIDO DE LA GUÍA:
---
{texto[:8000]}
---

INSTRUCCIONES:
1. Divide el contenido en exactamente {dias} partes (una para cada día de estudio)
2. Para CADA día genera exactamente 10 preguntas variadas:
   - 6 preguntas de opción múltiple (4 opciones: a, b, c, d)
   - 2 preguntas de verdadero o falso (opciones: "Verdadero", "Falso")
   - 2 preguntas de completar el espacio (opcion_a = respuesta correcta, opcion_b y opcion_c = distractores)
3. Usa lenguaje SIMPLE y DIVERTIDO para niños
4. Las preguntas deben ser variadas: no repitas el mismo formato
5. Incluye una explicación corta de por qué cada respuesta es correcta
6. Materia detectada o sugerida: {materia if materia else 'detectar automáticamente'}

RESPONDE ÚNICAMENTE con un JSON válido con esta estructura exacta:
{{
  "titulo": "Título de la guía",
  "materia": "Nombre de la materia",
  "resumen_general": "Breve descripción de lo que aprenderá el niño",
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
}}

NO incluyas texto antes o después del JSON. Solo el JSON."""

    response = model.generate_content(prompt)
    texto_respuesta = response.text.strip()

    # Limpiar posibles marcadores de código
    texto_respuesta = re.sub(r'^```json\s*', '', texto_respuesta)
    texto_respuesta = re.sub(r'^```\s*', '', texto_respuesta)
    texto_respuesta = re.sub(r'\s*```$', '', texto_respuesta)

    try:
        data = json.loads(texto_respuesta)
    except json.JSONDecodeError:
        # Intentar extraer JSON del texto
        match = re.search(r'\{[\s\S]+\}', texto_respuesta)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError(f"Gemini no retornó JSON válido: {texto_respuesta[:200]}")

    # Validar estructura mínima
    if "dias" not in data:
        raise ValueError("Respuesta de Gemini sin campo 'dias'")

    return data


def generar_resumen_dia(texto_dia: str, nombre_alumno: str = "amigo") -> str:
    """
    Genera un resumen interactivo y divertido del contenido del día,
    personalizado para el alumno. Usado en la fase de estudio.
    """
    model = _get_model()

    prompt = f"""Eres un maestro súper divertido que le explica a {nombre_alumno} el siguiente tema escolar.

CONTENIDO:
{texto_dia[:3000]}

INSTRUCCIONES:
- Explica el tema de forma divertida y simple para un niño de primaria
- Usa emojis para hacer el texto más visual
- Divide en 3-5 puntos clave con títulos llamativos
- Usa ejemplos de la vida cotidiana de los niños
- Máximo 300 palabras
- Termina con una frase motivacional

Responde solo con el texto explicativo, sin JSON."""

    response = model.generate_content(prompt)
    return response.text.strip()


def validar_configuracion() -> dict:
    """Verifica que Gemini esté configurado correctamente."""
    if not GEMINI_API_KEY:
        return {"ok": False, "error": "GEMINI_API_KEY no está configurada"}
    try:
        model = _get_model()
        response = model.generate_content("Responde solo: OK")
        if "OK" in response.text.upper() or response.text.strip():
            return {"ok": True, "modelo": MODEL_NAME}
        return {"ok": False, "error": "Respuesta inesperada de Gemini"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
