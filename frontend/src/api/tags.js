import api from "../lib/axios";

// ── Tags ──────────────────────────────────────────────────────────────────────

/** Lista todos los tags con sus vecinos */
export const getTags = () => api.get("/tags");

/** Crea un tag nuevo en inventario (solo código, sin asignar ni vender) */
export const createTag = (codigo) => api.post("/tags", { codigo });

/** Toggle activo/inactivo — usa ID entero (no UUID), igual que el backend */
export const toggleTag = (id) => api.patch(`/tags/${id}/toggle`);

/** Stock: cantidad de tags sin vender */
export const getTagStock = () => api.get("/tags/stock");

/** Historial completo de ventas con tag relacionado */
export const getTagSales = () => api.get("/tag_sales");

// ── Tag Sales ─────────────────────────────────────────────────────────────────

/** Registra la venta de un tag asignándolo a un vecino */
export const createTagSale = (tagId, vecinoId) =>
    api.post("/tag_sales", {
        tag_id: tagId,
        vecino_id: vecinoId,
    });

/** Elimina una venta por su ID */
export const deleteTagSale = (saleId) => api.delete(`/tag_sales/${saleId}`);
