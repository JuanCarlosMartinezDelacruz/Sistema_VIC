<?php
header('Access-Control-Allow-Origin: *'); 
header('Content-Type: application/json');

// Clever Cloud inyecta estas variables automáticamente si vinculas el Add-on
$servidor = getenv("MYSQL_ADDON_HOST");
$usuario  = getenv("MYSQL_ADDON_USER");
$password = getenv("MYSQL_ADDON_PASSWORD");
$db       = getenv("MYSQL_ADDON_DB");

$conn = new mysqli($servidor, $usuario, $password, $db);

if ($conn->connect_error) {
    die(json_encode(["error" => "Error de conexión"]));
}

$result = $conn->query("SELECT timestamp, sensor, voltaje, corriente, potencia FROM lecturas_energia ORDER BY id DESC LIMIT 100");

$data = [];
while($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);
$conn->close();
?>     
