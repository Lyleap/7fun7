<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json");

date_default_timezone_set('Asia/Phnom_Penh');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

/*
|--------------------------------------------------------------------------
| Proxy DB requests to local Flask API through Cloudflare Tunnel
|--------------------------------------------------------------------------
| This keeps your old api.php logic below as fallback, but DB-related
| requests now go to database-flask.py instead of Hostinger MySQL.
*/

$FLASK_API_BASE = "https://db.7fun7-api.online/api";

$type = $_GET['type'] ?? '';

$proxyTypes = [
    'setup',
    'matches',
    'user',
    'betslips',
    'transactions',
    'admin',
    'stats'
];

if (in_array($type, $proxyTypes, true)) {
    proxyToFlask($FLASK_API_BASE);
    exit;
}

function proxyToFlask($baseUrl) {
    $queryString = $_SERVER['QUERY_STRING'] ?? '';
    $targetUrl = $baseUrl;

    if (!empty($queryString)) {
        $targetUrl .= '?' . $queryString;
    }

    $method = $_SERVER['REQUEST_METHOD'];
    $ch = curl_init($targetUrl);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $headers = [];

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (!empty($contentType)) {
        $headers[] = "Content-Type: " . $contentType;
    } else {
        $headers[] = "Content-Type: application/json";
    }

    // Forward JSON/raw body
    if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
        if (!empty($_FILES)) {
            $postFields = $_POST;

            foreach ($_FILES as $fieldName => $file) {
                if (is_uploaded_file($file['tmp_name'])) {
                    $postFields[$fieldName] = new CURLFile(
                        $file['tmp_name'],
                        $file['type'],
                        $file['name']
                    );
                }
            }

            curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        } else {
            $body = file_get_contents("php://input");
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    curl_close($ch);

    if ($response === false || !empty($error)) {
        http_response_code(502);
        echo json_encode([
            "error" => "Failed to connect to Flask API",
            "message" => $error
        ]);
        return;
    }

    http_response_code($httpCode ?: 200);
    echo $response;
}