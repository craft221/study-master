"""
Sync es.json with en.json structure, lifting existing Spanish translations.
For new keys, use embedded translations dict.
For unknown leaves, fall back to English.

This script is intentionally idempotent and re-runnable.
"""
import json, io, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG_DIR = os.path.join(ROOT, 'frontend', 'messages')


def flatten_with_values(o, p=''):
    out = {}
    if isinstance(o, dict):
        for k, v in o.items():
            np = f'{p}.{k}' if p else k
            if isinstance(v, (dict, list)):
                out.update(flatten_with_values(v, np))
            else:
                out[np] = v
    elif isinstance(o, list):
        for i, v in enumerate(o):
            np = f'{p}.{i}'
            if isinstance(v, (dict, list)):
                out.update(flatten_with_values(v, np))
            else:
                out[np] = v
    return out


def build_mirror(en_node, path, existing_flat, new_translations):
    if isinstance(en_node, dict):
        return {k: build_mirror(v, f'{path}.{k}' if path else k, existing_flat, new_translations) for k, v in en_node.items()}
    if isinstance(en_node, list):
        return [build_mirror(v, f'{path}.{i}', existing_flat, new_translations) for i, v in enumerate(en_node)]
    if path in existing_flat:
        return existing_flat[path]
    if path in new_translations:
        return new_translations[path]
    return en_node  # English fallback


# ---------------------------------------------------------------------------
# Spanish translations for keys missing from old es.json
# ---------------------------------------------------------------------------
ES_NEW = {
    "about.features.list.4.title": "IA personalizada",
    "about.features.list.4.description": "Una asistencia adaptada a tu forma de estudiar",
    "about.features.list.5.title": "Comunidad activa",
    "about.features.list.5.description": "Aprende con otros y comparte tus mejores recursos",
    "contact.faq.privacy": "Politica de privacidad",
    "contact.faq.terms": "Terminos de uso",
    "contact.form.subjectSelect": "Selecciona un asunto",
    "contact.form.success.message": "Te responderemos lo antes posible.",
    "contact.form.success.sendAnother": "Enviar otro mensaje",
    "legal.privacy.sections.changes.title": "Cambios en esta politica",
    "legal.privacy.sections.changes.content": "Podemos actualizar esta politica de privacidad ocasionalmente. Te notificaremos cualquier cambio importante por correo electronico o mediante un aviso en nuestra plataforma.",
    "legal.privacy.sections.cookies.manage": "Puedes administrar tus preferencias de cookies en cualquier momento desde la configuracion de tu cuenta.",
    "legal.privacy.sections.cookies.types.0.title": "Cookies esenciales",
    "legal.privacy.sections.cookies.types.1.title": "Cookies analiticas",
    "legal.privacy.sections.cookies.types.2.title": "Cookies de preferencias",
    "legal.privacy.sections.dataProtection.intro": "Implementamos las siguientes medidas para proteger tus datos:",
    "legal.privacy.sections.dataProtection.title": "Proteccion de datos",
    "legal.privacy.sections.dataProtection.items.0.title": "Cifrado",
    "legal.privacy.sections.dataProtection.items.0.description": "Tus datos estan cifrados en transito (TLS) y en reposo (AES-256).",
    "legal.privacy.sections.dataProtection.items.1.title": "Control de acceso",
    "legal.privacy.sections.dataProtection.items.1.description": "Solo el personal autorizado puede acceder a tus datos personales.",
    "legal.privacy.sections.dataProtection.items.2.title": "Auditorias de seguridad",
    "legal.privacy.sections.dataProtection.items.2.description": "Realizamos auditorias periodicas para identificar y corregir vulnerabilidades.",
    "legal.privacy.sections.dataProtection.items.3.title": "Copias de seguridad",
    "legal.privacy.sections.dataProtection.items.3.description": "Realizamos copias de seguridad regulares para evitar la perdida de datos.",
    "legal.privacy.sections.dataRetention.title": "Conservacion de datos",
    "legal.privacy.sections.dataRetention.intro": "Conservamos tus datos durante los siguientes periodos:",
    "legal.privacy.sections.dataRetention.items.0.title": "Cuenta activa",
    "legal.privacy.sections.dataRetention.items.0.description": "Mientras tu cuenta este activa.",
    "legal.privacy.sections.dataRetention.items.1.title": "Despues del cierre de la cuenta",
    "legal.privacy.sections.dataRetention.items.1.description": "Hasta 30 dias, despues se eliminan permanentemente.",
    "legal.privacy.sections.dataRetention.items.2.title": "Copias de seguridad",
    "legal.privacy.sections.dataRetention.items.2.description": "Conservadas hasta 90 dias por motivos de seguridad.",
    "legal.privacy.sections.dataRetention.items.3.title": "Datos legales",
    "legal.privacy.sections.dataRetention.items.3.description": "Conservados durante el periodo legal requerido (facturacion, cumplimiento).",
    "legal.privacy.sections.dataSharing.title": "Intercambio de datos",
    "legal.privacy.sections.dataSharing.intro": "No vendemos tus datos. Podemos compartir cierta informacion con:",
    "legal.privacy.sections.dataSharing.items.0.title": "Proveedores de servicios",
    "legal.privacy.sections.dataSharing.items.0.description": "Terceros que nos ayudan a operar la plataforma (alojamiento, pagos, IA).",
    "legal.privacy.sections.dataSharing.items.1.title": "Obligaciones legales",
    "legal.privacy.sections.dataSharing.items.1.description": "Si una autoridad competente lo exige por ley.",
    "legal.privacy.sections.dataSharing.items.2.title": "Con tu consentimiento",
    "legal.privacy.sections.dataSharing.items.2.description": "Para usos especificos que requieran tu autorizacion explicita.",
    "legal.privacy.sections.dataUsage.title": "Uso de datos",
    "legal.privacy.sections.dataUsage.intro": "Utilizamos tus datos para:",
    "legal.privacy.sections.dataUsage.items.0": "Proporcionar y mejorar nuestros servicios",
    "legal.privacy.sections.dataUsage.items.1": "Personalizar tu experiencia de aprendizaje",
    "legal.privacy.sections.dataUsage.items.2": "Comunicarnos contigo (notificaciones, soporte)",
    "legal.privacy.sections.dataUsage.items.3": "Garantizar la seguridad de la plataforma",
    "legal.privacy.sections.dataUsage.items.4": "Cumplir con nuestras obligaciones legales",
    "legal.privacy.sections.dataUsage.items.5": "Realizar analisis estadisticos (datos anonimizados)",
    "legal.privacy.sections.minors.title": "Menores",
    "legal.privacy.sections.minors.content": "Nuestro servicio esta dirigido a personas mayores de 13 anos. Si descubrimos que hemos recopilado datos de un menor de 13 anos sin el consentimiento de los padres, eliminaremos estos datos rapidamente.",
    "legal.privacy.sections.yourRights.title": "Tus derechos",
    "legal.privacy.sections.yourRights.intro": "De conformidad con el RGPD, dispones de los siguientes derechos:",
    "legal.privacy.sections.yourRights.items.0.title": "Derecho de acceso",
    "legal.privacy.sections.yourRights.items.0.description": "Obtener una copia de los datos que tenemos sobre ti.",
    "legal.privacy.sections.yourRights.items.1.title": "Derecho de rectificacion",
    "legal.privacy.sections.yourRights.items.1.description": "Corregir tus datos personales si son inexactos.",
    "legal.privacy.sections.yourRights.items.2.title": "Derecho de supresion",
    "legal.privacy.sections.yourRights.items.2.description": "Solicitar la eliminacion de tus datos.",
    "legal.privacy.sections.yourRights.items.3.title": "Derecho de oposicion",
    "legal.privacy.sections.yourRights.items.3.description": "Oponerte a determinados tratamientos.",
    "legal.privacy.sections.yourRights.items.4.title": "Derecho a la portabilidad",
    "legal.privacy.sections.yourRights.items.4.description": "Recibir tus datos en un formato estructurado.",
    "legal.privacy.sections.yourRights.items.5.title": "Derecho a la limitacion",
    "legal.privacy.sections.yourRights.items.5.description": "Solicitar la limitacion del tratamiento de tus datos.",
    "legal.terms.articles.definitions.title": "Definiciones",
    "legal.terms.articles.definitions.content": "Servicio: la aplicacion Studera y todas sus funciones. Usuario: cualquier persona que utilice el Servicio. Cuenta: el espacio personal del Usuario en el Servicio. Contenido: cualquier dato, informacion, archivo o recurso publicado por el Usuario.",
    "legal.terms.articles.miscellaneous.title": "Disposiciones varias",
    "legal.terms.articles.miscellaneous.content": "Si alguna disposicion de estos Terminos resulta invalida, las demas disposiciones permaneceran en vigor. Los presentes Terminos se rigen por la ley aplicable. Cualquier disputa se sometera a los tribunales competentes.",
    "legal.terms.articles.services.title": "Descripcion de los Servicios",
    "legal.terms.articles.services.content": "Studera ofrece herramientas de aprendizaje en linea, incluyendo notas, flashcards, cuestionarios, IA, gamificacion y funciones colaborativas. Algunas funciones pueden requerir una suscripcion de pago.",
}


def main():
    en = json.load(io.open(os.path.join(MSG_DIR, 'en.json'), encoding='utf-8'))
    es_old = json.load(io.open(os.path.join(MSG_DIR, 'es.json'), encoding='utf-8'))
    es_flat = flatten_with_values(es_old)
    print(f'Existing es.json leaves: {len(es_flat)}')

    new_es = build_mirror(en, '', es_flat, ES_NEW)
    with io.open(os.path.join(MSG_DIR, 'es.json'), 'w', encoding='utf-8') as f:
        json.dump(new_es, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('es.json rewritten with en.json structure.')


if __name__ == '__main__':
    main()
