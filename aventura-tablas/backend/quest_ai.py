"""
Quest Escolar — IA INTERNA (sin API key, sin internet)
Lee PDFs, Word, imágenes y texto plano.
Genera preguntas automáticamente con algoritmo propio.
"""
import re, json, random, io, os
from typing import List, Dict

# ── Extractores de texto ────────────────────────────────────────

def extraer_texto_pdf(pdf_bytes: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        partes = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                partes.append(t)
        texto = "\n".join(partes).strip()
        if texto:
            return texto
    except Exception as e:
        pass

    # Fallback: pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            partes = [p.extract_text() or "" for p in pdf.pages]
        texto = "\n".join(partes).strip()
        if texto:
            return texto
    except Exception:
        pass

    raise ValueError("No se pudo extraer texto del PDF. Intenta con un PDF de texto (no escaneado) o usa la opción 'Pegar Texto'.")


def extraer_texto_word(docx_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(docx_bytes))
        parrafos = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(parrafos)
    except Exception as e:
        raise ValueError(f"No se pudo leer el archivo Word. Guárdalo como PDF o copia el texto. ({e})")


def extraer_texto_imagen(imagen_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Intenta OCR con easyocr (si está instalado).
    Si no, indica al usuario que use PDF o texto.
    """
    try:
        import easyocr
        import numpy as np
        from PIL import Image
        img = Image.open(io.BytesIO(imagen_bytes))
        img_array = np.array(img)
        reader = easyocr.Reader(['es', 'en'], gpu=False, verbose=False)
        resultado = reader.readtext(img_array, detail=0)
        texto = " ".join(resultado)
        if texto.strip():
            return texto
    except ImportError:
        pass
    except Exception as e:
        pass

    raise ValueError(
        "Para subir imágenes/fotos necesitas la opción OCR. "
        "Por favor usa un PDF de texto o la opción '✏️ Pegar Texto' para copiar el contenido manualmente."
    )


# ── Generador de preguntas INTERNO ─────────────────────────────

def _limpiar_texto(texto: str) -> str:
    texto = re.sub(r'\s+', ' ', texto)
    texto = re.sub(r'[^\w\s\.,;:¿?¡!()\-áéíóúÁÉÍÓÚñÑüÜ]', '', texto)
    return texto.strip()

def _dividir_oraciones(texto: str) -> List[str]:
    oraciones = re.split(r'(?<=[.!?])\s+', texto)
    return [o.strip() for o in oraciones if len(o.strip()) > 20]

def _dividir_parrafos(texto: str) -> List[str]:
    parrafos = re.split(r'\n{2,}|\n(?=[A-ZÁÉÍÓÚ])', texto)
    return [p.strip() for p in parrafos if len(p.strip()) > 40]

def _extraer_palabras_clave(texto: str) -> List[str]:
    """Extrae palabras importantes (no stopwords)."""
    stopwords = {
        'el','la','los','las','un','una','unos','unas','de','del','en',
        'que','y','o','a','por','para','con','sin','sobre','entre','como',
        'se','su','sus','al','le','lo','les','es','son','fue','era',
        'hay','tiene','tienen','ser','estar','hacer','puede','también',
        'este','esta','estos','estas','ese','esa','esos','esas',
        'pero','más','ya','no','si','así','muy','todo','cuando'
    }
    palabras = re.findall(r'\b[A-Za-záéíóúÁÉÍÓÚñÑ]{4,}\b', texto)
    return list({p.lower() for p in palabras if p.lower() not in stopwords})

def _generar_distractores(respuesta: str, palabras_texto: List[str], n: int = 3) -> List[str]:
    """Genera opciones incorrectas plausibles."""
    candidatos = [p for p in palabras_texto if p.lower() != respuesta.lower() and len(p) > 3]
    random.shuffle(candidatos)
    distractores = candidatos[:n]
    while len(distractores) < n:
        distractores.append(f"ninguna de las anteriores" if len(distractores) == n-1 else f"opción {len(distractores)+1}")
    return distractores[:n]

def _generar_pregunta_completar(oracion: str, palabras_clave: List[str]) -> Dict:
    """Genera pregunta de llenar el espacio."""
    palabras_oracion = oracion.split()
    candidatos = [p for p in palabras_oracion if p.lower() in [pk.lower() for pk in palabras_clave] and len(p) > 3]
    if not candidatos:
        candidatos = [p for p in palabras_oracion if len(p) > 5]
    if not candidatos:
        return None
    palabra = random.choice(candidatos)
    pregunta_txt = oracion.replace(palabra, "_______", 1)
    distractores = _generar_distractores(palabra, palabras_clave, 3)
    opciones = [palabra] + distractores
    random.shuffle(opciones)
    letra = ["a","b","c","d"][opciones.index(palabra)]
    return {
        "tipo": "completar",
        "pregunta": f"Completa: {pregunta_txt}",
        "opcion_a": opciones[0],
        "opcion_b": opciones[1],
        "opcion_c": opciones[2],
        "opcion_d": opciones[3],
        "respuesta_correcta": letra,
        "explicacion": f"La palabra correcta es '{palabra}'.",
        "dificultad": 1
    }

def _generar_pregunta_verdadero_falso(oracion: str) -> Dict:
    """Genera pregunta V/F, a veces invirtiendo la oración."""
    es_verdadera = random.random() > 0.4  # 60% verdaderas para no confundir tanto
    if es_verdadera:
        return {
            "tipo": "verdadero_falso",
            "pregunta": f"¿Es correcto? → {oracion}",
            "opcion_a": "Verdadero",
            "opcion_b": "Falso",
            "opcion_c": "No sé",
            "opcion_d": "",
            "respuesta_correcta": "a",
            "explicacion": "Esta afirmación es correcta según el contenido.",
            "dificultad": 1
        }
    else:
        # Invertir negando o cambiando palabras clave
        oracion_falsa = re.sub(r'\b(no |sí |siempre |nunca )', lambda m: {
            'no ': '', 'sí ': 'no ', 'siempre ': 'nunca ', 'nunca ': 'siempre '
        }.get(m.group(), m.group()), oracion, count=1)
        if oracion_falsa == oracion:
            oracion_falsa = "No es cierto que: " + oracion
        return {
            "tipo": "verdadero_falso",
            "pregunta": f"¿Es correcto? → {oracion_falsa}",
            "opcion_a": "Verdadero",
            "opcion_b": "Falso",
            "opcion_c": "No sé",
            "opcion_d": "",
            "respuesta_correcta": "b",
            "explicacion": "Esta afirmación no es correcta. Revisa el contenido del día.",
            "dificultad": 2
        }

def _generar_pregunta_opcion_multiple(oracion: str, palabras_clave: List[str]) -> Dict:
    """Genera pregunta de opción múltiple basada en el contenido."""
    palabras = oracion.split()
    sujetos = [p for p in palabras if len(p) > 4 and p[0].isupper()]
    if not sujetos:
        sujetos = [p for p in palabras if len(p) > 5]
    if not sujetos:
        return None

    sujeto = sujetos[0]
    # Tipo de pregunta variado
    tipos_pregunta = [
        f"¿Qué es {sujeto}?",
        f"¿Cómo se llama {sujeto}?",
        f"¿Cuál es la característica de {sujeto}?",
        f"Según el texto, ¿qué dice sobre {sujeto}?",
        f"¿Qué menciona el texto sobre {sujeto}?",
    ]
    pregunta_txt = random.choice(tipos_pregunta)

    # Respuesta correcta = parte relevante de la oración
    idx = oracion.find(sujeto)
    respuesta = oracion[idx:idx+50].split('.')[0].strip()
    if len(respuesta) > 60:
        respuesta = respuesta[:57] + "..."

    distractores = _generar_distractores(respuesta, palabras_clave, 3)
    opciones = [respuesta] + distractores
    random.shuffle(opciones)

    if respuesta not in opciones:
        opciones[0] = respuesta
    letra = ["a","b","c","d"][opciones.index(respuesta)]

    return {
        "tipo": "opcion_multiple",
        "pregunta": pregunta_txt,
        "opcion_a": opciones[0],
        "opcion_b": opciones[1],
        "opcion_c": opciones[2],
        "opcion_d": opciones[3],
        "respuesta_correcta": letra,
        "explicacion": f"Según el texto: {oracion[:100]}",
        "dificultad": 2
    }


def _generar_preguntas_del_chunk(chunk: str, n: int = 10) -> List[Dict]:
    """Genera n preguntas para un fragmento de texto."""
    palabras_clave = _extraer_palabras_clave(chunk)
    oraciones = _dividir_oraciones(chunk)

    if len(oraciones) < 2:
        oraciones = [chunk[i:i+150] for i in range(0, len(chunk), 150) if chunk[i:i+150].strip()]

    preguntas = []
    intentos = 0
    max_intentos = len(oraciones) * 3

    tipos = (["opcion_multiple"]*6 + ["verdadero_falso"]*2 + ["completar"]*2)
    random.shuffle(tipos)
    tipo_idx = 0

    while len(preguntas) < n and intentos < max_intentos:
        intentos += 1
        oracion = random.choice(oraciones) if oraciones else chunk[:200]
        tipo = tipos[tipo_idx % len(tipos)]
        tipo_idx += 1

        p = None
        if tipo == "opcion_multiple":
            p = _generar_pregunta_opcion_multiple(oracion, palabras_clave)
        elif tipo == "verdadero_falso":
            p = _generar_pregunta_verdadero_falso(oracion)
        elif tipo == "completar":
            p = _generar_pregunta_completar(oracion, palabras_clave)

        if p:
            # Evitar preguntas duplicadas
            if not any(q["pregunta"] == p["pregunta"] for q in preguntas):
                preguntas.append(p)

    # Completar con V/F si faltan
    while len(preguntas) < n and oraciones:
        oracion = random.choice(oraciones)
        p = _generar_pregunta_verdadero_falso(oracion)
        preguntas.append(p)

    return preguntas[:n]


# ── Plan de estudio INTERNO ─────────────────────────────────────

def generar_plan_estudio(texto: str, dias: int = 5, materia: str = "", nivel: str = "primaria") -> dict:
    """
    Divide el texto en `dias` partes y genera 10 preguntas por día.
    100% interno, sin internet ni API.
    """
    texto_limpio = _limpiar_texto(texto)

    # Detectar materia si no se especificó
    if not materia:
        palabras = texto_limpio.lower()
        if any(w in palabras for w in ['suma','resta','número','ecuación','fracción','geometría']):
            materia = "Matemáticas"
        elif any(w in palabras for w in ['célula','animal','planta','ecosistema','biología','organismo']):
            materia = "Ciencias Naturales"
        elif any(w in palabras for w in ['historia','guerra','revolución','siglo','rey','presidente']):
            materia = "Historia"
        elif any(w in palabras for w in ['verbo','sustantivo','adjetivo','oración','gramática','sílaba']):
            materia = "Español"
        elif any(w in palabras for w in ['país','capital','continente','río','montaña','mapa']):
            materia = "Geografía"
        else:
            materia = "Estudio General"

    # Dividir texto en chunks por día
    total = len(texto_limpio)
    chunk_size = max(total // dias, 200)
    chunks = []
    for i in range(dias):
        inicio = i * chunk_size
        fin = inicio + chunk_size if i < dias - 1 else total
        chunk = texto_limpio[inicio:fin].strip()
        if chunk:
            chunks.append(chunk)

    # Si hay menos chunks que días, repetir el último
    while len(chunks) < dias:
        chunks.append(chunks[-1] if chunks else texto_limpio[:500])

    # Generar plan por día
    dias_plan = []
    for i, chunk in enumerate(chunks[:dias]):
        palabras_clave = _extraer_palabras_clave(chunk)
        titulo_dia = f"Día {i+1}: {' '.join(palabras_clave[:3]).title()}" if palabras_clave else f"Día {i+1}"

        preguntas = _generar_preguntas_del_chunk(chunk, n=10)

        # Resumen del día (primeras 3 oraciones del chunk)
        oraciones_dia = _dividir_oraciones(chunk)
        resumen = ". ".join(oraciones_dia[:2]) + "." if len(oraciones_dia) >= 2 else chunk[:200]

        dias_plan.append({
            "dia": i + 1,
            "titulo": titulo_dia,
            "resumen": resumen[:300],
            "conceptos_clave": palabras_clave[:5],
            "preguntas": preguntas
        })

    total_preguntas = sum(len(d["preguntas"]) for d in dias_plan)

    return {
        "titulo": f"Guía de {materia}",
        "materia": materia,
        "resumen_general": f"Plan de estudio de {dias} días con {total_preguntas} preguntas generadas automáticamente.",
        "dias": dias_plan
    }


def generar_resumen_dia(texto_dia: str, nombre_alumno: str = "amigo") -> str:
    """Genera resumen del día sin IA externa."""
    oraciones = _dividir_oraciones(texto_dia)[:4]
    palabras = _extraer_palabras_clave(texto_dia)[:5]
    resumen = " ".join(oraciones) if oraciones else texto_dia[:300]
    temas = ", ".join(palabras).title() if palabras else "los temas del día"
    return (
        f"📚 Hoy estudiarás: **{temas}**\n\n"
        f"📖 Contenido del día:\n{resumen}\n\n"
        f"💡 Tip: Lee con atención, ¡las preguntas vendrán de este contenido!\n\n"
        f"⚡ ¡Tú puedes, {nombre_alumno}! ¡A estudiar!"
    )


def validar_configuracion() -> dict:
    """Sin API externa, siempre disponible."""
    libs = []
    try:
        import PyPDF2; libs.append("PyPDF2")
    except ImportError:
        pass
    try:
        from docx import Document; libs.append("python-docx")
    except ImportError:
        pass
    return {
        "ok": True,
        "modo": "IA Interna (sin API key)",
        "librerias": libs,
        "mensaje": "Sistema de generación de preguntas interno activo ✅"
    }
