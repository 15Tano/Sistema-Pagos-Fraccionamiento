# TODO: Update Payment Logic for Overpayments

## Frontend Updates

-   [x] Remove max="280" from cantidad input in Pagos.jsx
-   [x] Remove validation error for cantidad > 280 in validateForm()
-   [x] Update calculateRestantePreview() to handle overpayments (show 0 if exceeds)
-   [x] Modify handleSubmit() to send full cantidad

## Backend Updates

-   [x] Modify store() in PagoController.php to handle overpayments:
    -   Calculate needed for current month
    -   If cantidad > needed, create payment for current (needed, restante=0) and handle excess for next months
-   [x] Update recalculateRestanteForMonth() to handle multiple months
-   [x] Update update() method for multi-month adjustments
-   [x] Ensure tag activation remains monthly-based

## Testing

-   [ ] Test payment of 500: current month 280 (restante=0), next month 220 (restante=60)
-   [ ] Test larger amounts for multiple months
-   [ ] Verify tag activation logic
