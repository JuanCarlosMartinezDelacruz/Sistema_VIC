<?php
$servidor = "sql213.infinityfree.com";
$usuario  = "if0_40752715";
$password = "blrrZk6SiSfPs";
$db       = "if0_40752715_sistemavicregistro";

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