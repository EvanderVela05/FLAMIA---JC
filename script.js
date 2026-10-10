
const PRECIO_VELA = 15000;
const carrito = [];

const listaCarrito = document.querySelector("#lista-carrito");
const carritoVacio = document.querySelector("#carrito-vacio");
const totalUnidades = document.querySelector("#total-unidades");
const subtotalCarrito = document.querySelector("#subtotal-carrito");

const formulario = document.querySelector("#formulario-contacto");
const estadoFormulario = document.querySelector("#estado-formulario");
const botonEnviar = document.querySelector("#boton-enviar");

const tipoPedido = document.querySelector("#tipo-pedido");
const tipoEntrega = document.querySelector("#tipo-entrega");
const direccion = document.querySelector("#direccion");
const ciudad = document.querySelector("#ciudad");

function formatoCOP(valor) {
    return valor.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    });
}

document.querySelectorAll(".boton-carrito").forEach((boton) => {
    boton.addEventListener("click", () => {
        const tarjeta = boton.closest(".producto");
        const nombre = tarjeta.dataset.nombre;
        const campoCantidad = tarjeta.querySelector(".cantidad-producto");
        const cantidad = Number(campoCantidad.value);

        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
            alert("Selecciona una cantidad entre 1 y 99.");
            return;
        }

        const existente = carrito.find(
            producto => producto.nombre === nombre
        );

        if (existente) {
            if (existente.cantidad + cantidad > 99) {
                alert("El máximo es 99 unidades por sabor.");
                return;
            }

            existente.cantidad += cantidad;
        } else {
            carrito.push({
                nombre,
                precio: PRECIO_VELA,
                cantidad
            });
        }

        actualizarCarrito();
    });
});

function actualizarCarrito() {
    listaCarrito.replaceChildren();

    let unidades = 0;
    let subtotal = 0;

    carrito.forEach((producto, indice) => {
        unidades += producto.cantidad;
        subtotal += producto.precio * producto.cantidad;

        const item = document.createElement("div");
        item.className = "item-carrito";

        const informacion = document.createElement("div");

        const nombre = document.createElement("h3");
        nombre.textContent = producto.nombre;

        const precio = document.createElement("p");
        precio.textContent = `${formatoCOP(producto.precio)} por unidad`;

        const total = document.createElement("p");
        total.textContent =
            `Subtotal: ${formatoCOP(producto.precio * producto.cantidad)}`;

        informacion.append(nombre, precio, total);

        const controles = document.createElement("div");
        controles.className = "controles-carrito";

        const menos = document.createElement("button");
        menos.type = "button";
        menos.textContent = "−";
        menos.setAttribute("aria-label", "Disminuir cantidad");

        menos.addEventListener("click", () => {
            producto.cantidad--;

            if (producto.cantidad <= 0) {
                carrito.splice(indice, 1);
            }

            actualizarCarrito();
        });

        const cantidad = document.createElement("span");
        cantidad.textContent = producto.cantidad;

        const mas = document.createElement("button");
        mas.type = "button";
        mas.textContent = "+";
        mas.setAttribute("aria-label", "Aumentar cantidad");

        mas.addEventListener("click", () => {
            if (producto.cantidad >= 99) {
                alert("El máximo es 99 unidades por sabor.");
                return;
            }

            producto.cantidad++;
            actualizarCarrito();
        });

        const retirar = document.createElement("button");
        retirar.type = "button";
        retirar.textContent = "Retirar";
        retirar.className = "eliminar-producto";

        retirar.addEventListener("click", () => {
            carrito.splice(indice, 1);
            actualizarCarrito();
        });

        controles.append(menos, cantidad, mas, retirar);
        item.append(informacion, controles);
        listaCarrito.appendChild(item);
    });

    carritoVacio.hidden = carrito.length > 0;
    totalUnidades.textContent = unidades;
    subtotalCarrito.textContent = formatoCOP(subtotal);
}

document.querySelector("#vaciar-carrito").addEventListener("click", () => {
    carrito.length = 0;
    actualizarCarrito();
});

document.querySelector("#ir-a-pedido").addEventListener("click", () => {
    tipoPedido.value = "Pedido normal";
    actualizarCamposEntrega();

    document.querySelector("#contacto").scrollIntoView({
        behavior: "smooth"
    });
});

function actualizarCamposEntrega() {
    const esPedido = tipoPedido.value !== "Consulta";
    const esDomicilio = tipoEntrega.value === "Domicilio";

    direccion.required = esPedido && esDomicilio;
    ciudad.required = esPedido && esDomicilio;
}

tipoPedido.addEventListener("change", actualizarCamposEntrega);
tipoEntrega.addEventListener("change", actualizarCamposEntrega);

actualizarCamposEntrega();
actualizarCarrito();

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    estadoFormulario.textContent = "";

    if (!formulario.checkValidity()) {
        formulario.reportValidity();
        return;
    }

    if (tipoPedido.value === "Pedido normal" && carrito.length === 0) {
        estadoFormulario.textContent =
            "Agrega al menos una vela al carrito antes de hacer el pedido.";
        return;
    }

    const personalizacion =
        formulario.elements.personalizacion.value.trim();

    if (
        tipoPedido.value === "Vela personalizada" &&
        !personalizacion
    ) {
        estadoFormulario.textContent =
            "Describe cómo deseas tu vela personalizada.";
        formulario.elements.personalizacion.focus();
        return;
    }

    const datos = {
        nombre: formulario.elements.nombre.value.trim(),
        correo: formulario.elements.correo.value.trim(),
        telefono: formulario.elements.telefono.value.trim(),
        asunto: formulario.elements.asunto.value,
        mensaje: formulario.elements.mensaje.value.trim(),
        tipoPedido: tipoPedido.value,
        tipoEntrega: tipoEntrega.value,
        direccion: direccion.value.trim(),
        ciudad: ciudad.value.trim(),
        barrio: formulario.elements.barrio.value.trim(),
        referencia: formulario.elements.referencia.value.trim(),
        personalizacion,
        productos: carrito.map(producto => ({
            nombre: producto.nombre,
            cantidad: producto.cantidad
        }))
    };

    botonEnviar.disabled = true;
    botonEnviar.textContent = "Enviando...";

    try {
        const respuesta = await fetch("/api/pedidos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datos)
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo registrar el pedido."
            );
        }

        estadoFormulario.textContent =
            `Solicitud registrada correctamente. Número de pedido: ${resultado.pedidoId}`;

        formulario.reset();
        carrito.length = 0;

        actualizarCarrito();
        actualizarCamposEntrega();

    } catch (error) {
        console.error("Error al enviar el pedido:", error);

        estadoFormulario.textContent =
            "No se pudo enviar la solicitud. Comprueba que el servidor esté funcionando.";
    } finally {
        botonEnviar.disabled = false;
        botonEnviar.textContent = "Enviar solicitud";
    }
});
