<?php
header('Access-Control-Allow-Origin: *'); 
header('Content-Type: application/json');

// Tus credenciales de InfinityFree
$servidor = "sql213.infinityfree.com";
$usuario  = "if0_40752715";
$password = "blrrZk6SiSfPs";
$db       = "if0_40752715_sistemavicregistro";

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