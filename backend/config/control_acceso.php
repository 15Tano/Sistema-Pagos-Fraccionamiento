<?php

return [
    'monitor_enabled' => env('CONTROL_ACCESO_MONITOR_ENABLED', false),
    'monitor_stale_seconds' => 90,
    'monitor_vigencias_stale_seconds' => 300,
    'monitor_future_tolerance_seconds' => 30,
    'max_body_bytes' => 1024 * 1024,
    'max_state_bytes' => 16 * 1024,
    'max_responses' => 100,
    'max_response_bytes' => 512 * 1024,
    'max_rows' => 2000,
];
