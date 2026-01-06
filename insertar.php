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

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $sensor    = $_POST['sensor'];
    $voltaje   = $_POST['voltaje'];
    $corriente = $_POST['corriente'];
    $potencia  = $_POST['potencia'];

    $sql = "INSERT INTO lecturas_energia (sensor, voltaje, corriente, potencia) 
            VALUES ('$sensor', '$voltaje', '$corriente', '$potencia')";

    if ($conn->query($sql) === TRUE) {
        echo "EXITO";
    } else {
        echo "Error: " . $conn->error;
    }
}
$conn->close();
?>

