<?php
date_default_timezone_set('America/Mexico_City');

$servidor = getenv("MYSQL_ADDON_HOST");
$usuario  = getenv("MYSQL_ADDON_USER");
$password = getenv("MYSQL_ADDON_PASSWORD");
$db       = getenv("MYSQL_ADDON_DB");

$conn = new mysqli($servidor, $usuario, $password, $db);

if ($conn->connect_error) {
    die("Error: " . $conn->connect_error);
}

// --- PASO 1: Esto corrige el reloj interno de la conexión ---
$conn->query("SET time_zone = '-06:00'");

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $sensor    = $_POST['sensor'];
    $voltaje   = $_POST['voltaje'];
    $corriente = $_POST['corriente'];
    $potencia  = $_POST['potencia'];

    // --- PASO 2: Forzamos el uso de la hora de México en la columna 'timestamp' ---
    $fecha_actual = date("Y-m-d H:i:s");

    $sql = "INSERT INTO lecturas_energia (sensor, voltaje, corriente, potencia, timestamp) 
            VALUES ('$sensor', '$voltaje', '$corriente', '$potencia', '$fecha_actual')";

    if ($conn->query($sql) === TRUE) {
        echo "EXITO";
    } else {
        echo "Error: " . $conn->error;
    }
}
$conn->close();
?>
