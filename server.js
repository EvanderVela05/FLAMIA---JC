
require("dotenv").config();

const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "flamia";

const PRECIO_VELA = 15000;

const PRODUCTOS_PERMITIDOS = [
    "Vela de chocolate",
    "Vela de vainilla",
    "Vela de frutos rojos",
    "Vela de fresa",
    "Vela de limón",
    "Vela de naranja",
    "Vela de café",
    "Vela de coco",
    "Vela de maracuyá",
    "Vela de arequipe"
];

const TIPOS_PEDIDO = [
    "Consulta",
    "Pedido normal",
    "Vela personalizada"
];

const TIPOS_ENTREGA = [
    "Domicilio",
    "Por acordar"
];

const ASUNTOS = [
    "Consulta de productos",
    "Pedido",
    "Otro"
];

let pedidos;
let clienteMongo;

app.disable("x-powered-by");

app.use(express.json({ limit: "20kb" }));

app.use(express.static(path.join(__dirname)));

app.get("/api/estado", (req, res) => {
    res.json({
        estado: "activo",
        baseDeDatos: Boolean(pedidos)
    });
});

app.post("/api/pedidos", async (req, res) => {
    try {
        if (!pedidos) {
            return res.status(503).json({
                error: "La base de datos no está disponible."
            });
        }

        const datos = req.body;

        if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
            return res.status(400).json({
                error: "Los datos del pedido no son válidos."
            });
        }

        const nombre = texto(datos.nombre);
        const correo = texto(datos.correo).toLowerCase();
        const telefono = texto(datos.telefono);
        const asunto = texto(datos.asunto);
        const mensaje = texto(datos.mensaje);
        const tipoPedido = texto(datos.tipoPedido);
        const tipoEntrega = texto(datos.tipoEntrega);
        const direccion = texto(datos.direccion);
        const ciudad = texto(datos.ciudad);
        const barrio = texto(datos.barrio);
        const referencia = texto(datos.referencia);
        const personalizacion = texto(datos.personalizacion);

        if (nombre.length < 2 || nombre.length > 100) {
            return res.status(400).json({
                error: "El nombre debe tener entre 2 y 100 caracteres."
            });
        }

        if (
            correo.length > 150 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
        ) {
            return res.status(400).json({
                error: "El correo electrónico no es válido."
            });
        }

        if (
            telefono.length < 7 ||
            telefono.length > 30
        ) {
            return res.status(400).json({
                error: "El teléfono debe tener entre 7 y 30 caracteres."
            });
        }

        if (!ASUNTOS.includes(asunto)) {
            return res.status(400).json({
                error: "Selecciona un asunto válido."
            });
        }

        if (!TIPOS_PEDIDO.includes(tipoPedido)) {
            return res.status(400).json({
                error: "El tipo de solicitud no es válido."
            });
        }

        if (!TIPOS_ENTREGA.includes(tipoEntrega)) {
            return res.status(400).json({
                error: "El tipo de entrega no es válido."
            });
        }

        if (mensaje.length > 2000) {
            return res.status(400).json({
                error: "El mensaje supera el límite permitido."
            });
        }

        if (
            direccion.length > 200 ||
            ciudad.length > 100 ||
            barrio.length > 100 ||
            referencia.length > 300 ||
            personalizacion.length > 1500
        ) {
            return res.status(400).json({
                error: "Uno de los campos supera la longitud permitida."
            });
        }

        if (
            tipoPedido !== "Consulta" &&
            tipoEntrega === "Domicilio" &&
            (!direccion || !ciudad)
        ) {
            return res.status(400).json({
                error: "Indica la dirección y la ciudad de entrega."
            });
        }

        if (
            tipoPedido === "Vela personalizada" &&
            !personalizacion
        ) {
            return res.status(400).json({
                error: "Describe cómo deseas tu vela personalizada."
            });
        }

        if (!Array.isArray(datos.productos) || datos.productos.length > 10) {
            return res.status(400).json({
                error: "La lista de productos no es válida."
            });
        }

        const productos = [];
        const cantidadesPorNombre = new Map();

        for (const producto of datos.productos) {
            if (
                !producto ||
                typeof producto.nombre !== "string" ||
                !PRODUCTOS_PERMITIDOS.includes(producto.nombre) ||
                !Number.isInteger(producto.cantidad) ||
                producto.cantidad < 1 ||
                producto.cantidad > 99
            ) {
                return res.status(400).json({
                    error: "Uno de los productos o sus cantidades no es válido."
                });
            }

            const cantidadAcumulada =
                (cantidadesPorNombre.get(producto.nombre) || 0) +
                producto.cantidad;

            if (cantidadAcumulada > 99) {
                return res.status(400).json({
                    error: "El máximo es 99 unidades por sabor."
                });
            }

            cantidadesPorNombre.set(
                producto.nombre,
                cantidadAcumulada
            );
        }

        for (const [nombreProducto, cantidad] of cantidadesPorNombre) {
            productos.push({
                nombre: nombreProducto,
                cantidad,
                precio: PRECIO_VELA,
                subtotal: cantidad * PRECIO_VELA
            });
        }

        if (tipoPedido === "Pedido normal" && productos.length === 0) {
            return res.status(400).json({
                error: "Agrega al menos una vela al carrito."
            });
        }

        const subtotal = productos.reduce(
            (suma, producto) => suma + producto.subtotal,
            0
        );

        const pedido = {
            nombre,
            correo,
            telefono,
            asunto,
            mensaje,
            tipoPedido,
            tipoEntrega,
            direccion,
            ciudad,
            barrio,
            referencia,
            personalizacion,
            productos,
            subtotal,
            estado: "Recibido",
            fechaCreacion: new Date()
        };

        const resultado = await pedidos.insertOne(pedido);

        return res.status(201).json({
            mensaje: "Pedido registrado correctamente.",
            pedidoId: resultado.insertedId.toString()
        });

    } catch (error) {
        console.error("Error al registrar pedido:", error);

        return res.status(500).json({
            error: "No se pudo registrar el pedido."
        });
    }
});

function texto(valor) {
    return typeof valor === "string" ? valor.trim() : "";
}

async function iniciarServidor() {
    if (!MONGODB_URI) {
        throw new Error(
            "Falta configurar MONGODB_URI en el archivo .env."
        );
    }

    clienteMongo = new MongoClient(MONGODB_URI);

    await clienteMongo.connect();

    const baseDatos = clienteMongo.db(DB_NAME);

    await baseDatos.command({ ping: 1 });

    pedidos = baseDatos.collection("pedidos");

    app.listen(PORT, () => {
        console.log(`FLAMIA está funcionando en http://localhost:${PORT}`);
        console.log("API disponible en /api/pedidos");
    });
}

iniciarServidor().catch(async (error) => {
    console.error("No se pudo iniciar el servidor:", error.message);

    if (clienteMongo) {
        await clienteMongo.close().catch(() => {});
    }

    process.exit(1);
});

process.on("SIGINT", async () => {
    if (clienteMongo) {
        await clienteMongo.close();
    }

    process.exit(0);
});

process.on("SIGTERM", async () => {
    if (clienteMongo) {
        await clienteMongo.close();
    }

    process.exit(0);
});
