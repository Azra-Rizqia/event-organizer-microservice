<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EventController;

Route::apiResource('events', EventController::class); 

Route::get('/health', function () {
    return response()->json([
        'service'   => 'event-service',
        'language'  => 'PHP',
        'framework' => 'Laravel',
        'database'  => 'mysql',
        'status'    => 'running'
    ]);
});