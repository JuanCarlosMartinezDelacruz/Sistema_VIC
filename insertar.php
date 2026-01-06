<?php
// 1. Esto ajusta la hora en PHP
date_default_timezone_set('America/Mexico_City');

$servidor = getenv("MYSQL_ADDON_HOST");
$usuario  = getenv("MYSQL_ADDON_USER");
$password = getenv("MYSQL_ADDON_PASSWORD");
$db       = getenv("MYSQL_ADDON_DB");

$conn = new mysqli($servidor, $usuario, $password, $db);

if ($conn->connect_error) {
    die("Error: " . $conn->connect_error);
}

// 2. Forzamos a la base de datos a entender que estamos en el desfase de México (-06:00)
$conn->query("SET time_zone = '-06:00'");

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $sensor    = $_POST['sensor'];
    $voltaje   = $_POST['voltaje'];
    $corriente = $_POST['corriente'];
    $potencia  = $_POST['potencia'];
    
    // 3. Creamos la fecha exacta desde PHP
    $fecha_actual = date("Y-m-d H:i:s");

    // 4. IMPORTANTE: He añadido 'fecha' a la consulta. 
    // Asegúrate de que tu columna se llame 'fecha' o cambia el nombre abajo:
    $sql = "INSERT INTO lecturas_energia (sensor, voltaje, corriente, potencia, fecha) 
            VALUES ('$sensor', '$voltaje', '$corriente', '$potencia', '$fecha_actual')";

    if ($conn->query($sql) === TRUE) {
        echo "EXITO. Registrado a las: " . $fecha_actual;
    } else {
        echo "Error: " . $conn->error;
    }
}
$conn->close();
?>
