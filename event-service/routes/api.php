<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\EventController;

Route::apiResource('events', EventController::class); 