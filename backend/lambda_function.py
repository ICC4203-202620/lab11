import json


def lambda_handler(event, context):
    parametros = event.get("queryStringParameters") or {}
    nombre = parametros.get("nombre") or "visitante"
    contenido = {
        "saludo": f"Hola, {nombre}",
        "actividad": "Encuentro de proyectos de ingeniería",
        "lugar": "Campus de la Universidad de los Andes",
        "descripcion": "Actividad ficticia utilizada para practicar la integración de servicios de AWS.",
        "solicitud": context.aws_request_id,
    }
    print(f"Consulta de actividad: {context.aws_request_id}")
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(contenido, ensure_ascii=False),
    }
