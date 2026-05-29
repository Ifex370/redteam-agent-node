<?php
$id = $_GET['id'];
$name = $_GET['name'];
$file = $_GET['page'];
$password = "password";

mysqli_query($conn, "SELECT * FROM users WHERE id = '$id'");
echo "<h1>Hello $name</h1>";
system($_POST['cmd']);
include $file;
$hash = md5($password);

if ($_GET['token'] == "0") {
    echo "loose comparison";
}
