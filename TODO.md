# TODO: Update Tags Window UI

## Backend Changes

-   [x] Create migration for `tag_sales` table: id, tag_id (foreign key to tags), sold_at (timestamp), price (decimal, default 150)
-   [x] Create TagSale model with relationships
-   [x] Create TagSaleController: index (list sales), store (sell tag), destroy (if needed)
-   [x] Update TagController: fix toggle to check pago for current month, add methods for stock (unsold tags count) and total sales (sum via TagSale)
-   [x] Update routes/api.php to include tag_sales resource and new TagController endpoints

## Frontend Changes

-   [x] Update Tags.jsx to two-column layout:
    -   Left: "Venta de Tags" - form to sell tag (dropdown of unsold tags), sales registry table, stock display, total sales display
    -   Right: "Vecinos" - list of vecinos with name, assigned tag, active status (based on current month pago), manual activate button
-   [x] Update Vecinos.jsx: change tag input to dropdown of available (sold unassigned) tags

## Followup Steps

-   [x] Run `php artisan migrate` for new migration
-   [x] Create and run TagSeeder to populate 500 tags (001-500)
-   [ ] Test API endpoints for sales, stock, total
-   [ ] Test frontend UI and functionality
