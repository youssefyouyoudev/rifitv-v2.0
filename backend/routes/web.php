<?php

use App\Http\Controllers\MediaGatewayController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('media/live/{token}', [MediaGatewayController::class, 'live']);
