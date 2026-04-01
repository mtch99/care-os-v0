// Stub env vars required by @careos/db (transitively imported by route handlers).
process.env.DATABASE_URL = 'postgres://localhost:5432/careos_test'
process.env.PORT = '3000'
