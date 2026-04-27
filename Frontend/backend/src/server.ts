import app from "./app.js";

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Afet Konum Kasası panel backend çalışıyor: http://localhost:${port}`);
  console.log("Demo kullanıcılar: super@demo.com / Demo123!, operation@demo.com / Demo123!, viewer@demo.com / Demo123!");
});
