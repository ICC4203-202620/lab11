const formulario = document.querySelector("#consulta");
const boton = formulario.querySelector("button");
const estado = document.querySelector("#estado");
const resultado = document.querySelector("#resultado");

formulario.addEventListener("submit", async (event) => {
  event.preventDefault();
  boton.disabled = true;
  resultado.hidden = true;
  estado.textContent = "Consultando la actividad…";

  const nombre = document.querySelector("#nombre").value.trim();
  const parametros = new URLSearchParams({ nombre });

  try {
    const respuesta = await fetch(`/api/actividad?${parametros}`);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const actividad = await respuesta.json();

    document.querySelector("#saludo").textContent = actividad.saludo;
    document.querySelector("#actividad").textContent = actividad.actividad;
    document.querySelector("#lugar").textContent = actividad.lugar;
    document.querySelector("#descripcion").textContent = actividad.descripcion;
    document.querySelector("#solicitud").textContent = actividad.solicitud;
    resultado.hidden = false;
    estado.textContent = "Respuesta recibida desde el backend";
  } catch (error) {
    estado.textContent = `No fue posible consultar la actividad (${error.message}). Revisar la integración de /api/actividad.`;
  } finally {
    boton.disabled = false;
  }
});
