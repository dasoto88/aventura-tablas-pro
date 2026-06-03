"""
Quest Escolar — Módulo IA con OpenRouter (gratis)
Modelos gratuitos: Llama 3.3 70B para texto, Llama Vision para imágenes.
"""
import os, json, base64, re, io

try:
    from openai import OpenAI
    OPENAI_SDK = True
except ImportError:
    OPENAI_SDK = False

try:
    import PyPDF2
    PDF_OK = True
except ImportError:
    PDF_OK = False

OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")

MODELO_TEXTO  = "meta-llama/llama-3.3-70b-instruct:free"
MODELO_VISION = "qwen/qwen2.5-vl-7b-instruct:free"  # visión gratuito


def _cliente():
    if not OPENAI_SDK:
        raise ValueError("Instala: pip install openai")
    if not OPENROUTER_KEY:
        raise ValueError("OPENROUTER_API_KEY no configurada en Render")
    return OpenAI(
        api_key=OPENROUTER_KEY,
        base_url="https://openrouter.ai/api/v1",
    )


def extraer_texto_pdf(pdf_bytes: bytes) -> str:
    if PDF_OK:
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            texto = "\n".join(p.extract_text() or "" for p in reader.pages)
            if texto.strip():
                return texto.strip()
        except Exception:
            pass
    return extraer_texto_imagen(pdf_bytes)


def extraer_texto_imagen(imagen_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    cliente = _cliente()
    if "pdf" in mime_type:
        mime_type = "image/jpeg"
    img_b64 = base64.b64encode(imagen_bytes).decode()

    # Intentar con varios modelos de visión hasta que uno funcione
    modelos_vision = [
        "qwen/qwen2.5-vl-7b-instruct:free",
        "qwen/qwen2-vl-7b-instruct:free",
        "meta-llama/llama-3.2-11b-vision-instruct",
    ]
    ultimo_error = None
    for modelo in modelos_vision:
        try:
            resp = cliente.chat.completions.create(
                model=modelo,
                messages=[{"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{img_b64}"}},
                    {"type": "text", "text": "Extrae TODO el texto de esta guía escolar. Solo el texto, sin comentarios."}
                ]}],
                max_tokens=4096,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            ultimo_error = e
            continue

    raise ValueError(
        "No se pudo leer la imagen automáticamente. "
        "Por favor sube un PDF de texto o escribe el contenido manualmente. "
        f"(Error: {ultimo_error})"
    )


def generar_plan_estudio(texto: str, dias: int = 5, materia: str = "", nivel: str = "primaria") -> dict:
    cliente = _cliente()
    prompt = f"""Eres un maestro de educación primaria. Crea un plan de estudio para niños de 6-12 años.

CONTENIDO:
{texto[:5000]}

INSTRUCCIONES:
- Divide en exactamente {dias} días de estudio
- Cada día: 10 preguntas (6 opción múltiple, 2 verdadero/falso, 2 completar)
- Lenguaje simple y divertido para niños
- Materia: {materia or 'detectar del contenido'}

Responde SOLO con JSON válido:
{{
  "titulo": "...",
  "materia": "...",
  "resumen_general": "...",
  "dias": [{{
    "dia": 1,
    "titulo": "...",
    "resumen": "...",
    "conceptos_clave": ["..."],
    "preguntas": [{{
      "tipo": "opcion_multiple",
      "pregunta": "...",
      "opcion_a": "...", "opcion_b": "...", "opcion_c": "...", "opcion_d": "...",
      "respuesta_correcta": "a",
      "explicacion": "...",
      "dificultad": 1
    }}]
  }}]
}}"""

    resp = cliente.chat.completions.create(
        model=MODELO_TEXTO,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8192,
        temperature=0.3,
    )
    txt = resp.choices[0].message.content.strip()
    txt = re.sub(r'^```json\s*|^```\s*|\s*```$', '', txt, flags=re.MULTILINE)

    try:
        data = json.loads(txt)
    except json.JSONDecodeError:
        m = re.search(r'\{[\s\S]+\}', txt)
        if m:
            data = json.loads(m.group())
        else:
            raise ValueError(f"IA no retornó JSON válido: {txt[:200]}")

    if "dias" not in data:
        raise ValueError("Respuesta sin campo 'dias'")
    return data


def generar_resumen_dia(texto_dia: str, nombre_alumno: str = "amigo") -> str:
    cliente = _cliente()
    resp = cliente.chat.completions.create(
        model=MODELO_TEXTO,
        messages=[{"role": "user", "content": f"""Eres un maestro divertido explicando a {nombre_alumno}.
Contenido: {texto_dia[:2000]}
Explica el tema con emojis, 3-5 puntos clave, ejemplos para niños, máximo 250 palabras.
Termina con una frase motivacional. Solo el texto, sin JSON."""}],
        max_tokens=800,
        temperature=0.5,
    )
    return resp.choices[0].message.content.strip()


def validar_configuracion() -> dict:
    if not OPENAI_SDK:
        return {"ok": False, "error": "Instala: pip install openai"}
    if not OPENROUTER_KEY:
        return {"ok": False, "error": "OPENROUTER_API_KEY no configurada"}
    try:
        resp = _cliente().chat.completions.create(
            model=MODELO_TEXTO,
            messages=[{"role": "user", "content": "Di solo: OK"}],
            max_tokens=5,
        )
        return {"ok": True, "modelo": MODELO_TEXTO, "respuesta": resp.choices[0].message.content}
    except Exception as e:
        return {"ok": False, "error": str(e)}
