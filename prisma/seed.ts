/**
 * prisma/seed.ts
 *
 * Seed inicial de la base de datos.
 * Carga el DML del PDF: categorías, insumos, empleados, procedimientos,
 * lotes, tickets de ejemplo y mermas de ejemplo.
 *
 * Ejecutar con: npx prisma db seed
 * (o: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de base de datos...");

  // ─── 1. Categorías ───────────────────────────────────────────────────────
  console.log("  Creando categorías...");
  const categorias = await Promise.all(
    [
      { id_categoria: 1, nombre_categoria: "OBTURACIONES" },
      { id_categoria: 2, nombre_categoria: "CIRUGÍA BUCAL" },
      { id_categoria: 3, nombre_categoria: "EXTRACCIONES" },
      { id_categoria: 4, nombre_categoria: "PRÓTESIS / CORONAS" },
      { id_categoria: 5, nombre_categoria: "INCRUSTACIONES" },
      { id_categoria: 6, nombre_categoria: "ENDODONCIAS" },
      { id_categoria: 7, nombre_categoria: "PEDIÁTRICO" },
      { id_categoria: 8, nombre_categoria: "PRÓTESIS PROVISIONAL" },
      { id_categoria: 9, nombre_categoria: "PRÓTESIS REMOVIBLES" },
      { id_categoria: 10, nombre_categoria: "IMPRESIÓN MODELOS" },
      { id_categoria: 11, nombre_categoria: "GUARDAS" },
      { id_categoria: 12, nombre_categoria: "PREVENTIVO" },
      { id_categoria: 13, nombre_categoria: "SELLAR Y PREVENIR" },
      { id_categoria: 14, nombre_categoria: "PROTECCIÓN" },
      { id_categoria: 15, nombre_categoria: "PROCEDIMIENTO ESPECÍFICO" },
    ].map((cat) =>
      prisma.categoria.upsert({
        where: { id_categoria: cat.id_categoria },
        update: {},
        create: cat,
      })
    )
  );
  console.log(`  ✓ ${categorias.length} categorías`);

  // ─── 2. Insumos ──────────────────────────────────────────────────────────
  console.log("  Creando insumos...");
  const insumosData = [
    { id_insumo: 1, nombre: "ANESTESIA BUCAL (CÁRPULAS)", unidad_medida: "Cartucho 1.8 ml", stock_minimo: 30, caduca: true },
    { id_insumo: 2, nombre: "AGUJA PARA ANESTESIA", unidad_medida: "Pieza", stock_minimo: 50, caduca: true },
    { id_insumo: 3, nombre: "GASAS ESTÉRILES", unidad_medida: "Pieza", stock_minimo: 100, caduca: true },
    { id_insumo: 4, nombre: "GUANTES DE LÁTEX / NITRILO", unidad_medida: "Par", stock_minimo: 100, caduca: true },
    { id_insumo: 5, nombre: "CUBREBOCAS TRICAPA", unidad_medida: "Pieza", stock_minimo: 50, caduca: false },
    { id_insumo: 6, nombre: "HILO DENTAL", unidad_medida: "Pieza", stock_minimo: 5, caduca: false },
    { id_insumo: 7, nombre: "EYECTOR DE SALIVA", unidad_medida: "Pieza", stock_minimo: 50, caduca: false },
    { id_insumo: 8, nombre: "BABERO DESECHABLE", unidad_medida: "Pieza", stock_minimo: 50, caduca: false },
    { id_insumo: 9, nombre: "CAMPO QUIRÚRGICO", unidad_medida: "Pieza", stock_minimo: 20, caduca: true },
    { id_insumo: 10, nombre: "HOJA DE BISTURÍ", unidad_medida: "Pieza", stock_minimo: 25, caduca: true },
    { id_insumo: 11, nombre: "SUTURA CON AGUJA", unidad_medida: "Sobre", stock_minimo: 15, caduca: true },
    { id_insumo: 12, nombre: "SOLUCIÓN FISIOLÓGICA", unidad_medida: "ml", stock_minimo: 250, caduca: true },
    { id_insumo: 13, nombre: "ESPONJA HEMOSTÁTICA", unidad_medida: "Cubo", stock_minimo: 10, caduca: true },
    { id_insumo: 14, nombre: "CEMENTO QUIRÚRGICO", unidad_medida: "Kit", stock_minimo: 2, caduca: true },
    { id_insumo: 15, nombre: "HILO RETRACTOR", unidad_medida: "Pieza", stock_minimo: 2, caduca: false },
    { id_insumo: 16, nombre: "ÁCIDO GRABADOR (37%)", unidad_medida: "Jeringa 3 g", stock_minimo: 5, caduca: true },
    { id_insumo: 17, nombre: "ADHESIVO DENTAL", unidad_medida: "Frasco 5 ml", stock_minimo: 3, caduca: true },
    { id_insumo: 18, nombre: "RESINA COMPUESTA", unidad_medida: "Jeringa 4 g", stock_minimo: 6, caduca: true },
    { id_insumo: 19, nombre: "CEMENTO RESINOSO DUAL", unidad_medida: "Jeringa 5 g", stock_minimo: 3, caduca: true },
    { id_insumo: 20, nombre: "DISCOS Y PUNTAS DE PULIDO", unidad_medida: "Pieza", stock_minimo: 20, caduca: false },
    { id_insumo: 21, nombre: "PASTA PARA PULIR", unidad_medida: "Jeringa 2 g", stock_minimo: 2, caduca: true },
    { id_insumo: 22, nombre: "CORONA DE ACERO CROMO", unidad_medida: "Pieza", stock_minimo: 5, caduca: false },
    { id_insumo: 23, nombre: "CEMENTO IONÓMERO DE VIDRIO", unidad_medida: "Kit", stock_minimo: 2, caduca: true },
    { id_insumo: 24, nombre: "DIQUE DE GOMA", unidad_medida: "Hoja", stock_minimo: 15, caduca: true },
    { id_insumo: 25, nombre: "LIMAS ENDODÓNTICAS", unidad_medida: "Pieza", stock_minimo: 12, caduca: false },
    { id_insumo: 26, nombre: "IRRIGANTE (HIPOCLORITO / EDTA)", unidad_medida: "ml", stock_minimo: 500, caduca: true },
    { id_insumo: 27, nombre: "CONOS DE PAPEL ABSORBENTE", unidad_medida: "Punta", stock_minimo: 50, caduca: true },
    { id_insumo: 28, nombre: "CONOS DE GUTAPERCHA", unidad_medida: "Punta", stock_minimo: 50, caduca: true },
    { id_insumo: 29, nombre: "CEMENTO SELLADOR ENDODÓNTICO", unidad_medida: "Jeringa 5 g", stock_minimo: 2, caduca: true },
    { id_insumo: 30, nombre: "OBTURACIÓN TEMPORAL (CAVIT)", unidad_medida: "Gramo", stock_minimo: 10, caduca: true },
    { id_insumo: 31, nombre: "LÁMINA DE ACETATO", unidad_medida: "Pieza", stock_minimo: 6, caduca: false },
    { id_insumo: 32, nombre: "ACRÍLICO DENTAL (POLÍMERO)", unidad_medida: "Gramo", stock_minimo: 50, caduca: true },
    { id_insumo: 33, nombre: "ACRÍLICO DENTAL (MONÓMERO)", unidad_medida: "ml", stock_minimo: 50, caduca: true },
    { id_insumo: 34, nombre: "PAPEL ARTICULAR", unidad_medida: "Tira", stock_minimo: 12, caduca: false },
    { id_insumo: 35, nombre: "SILICONA POR ADICIÓN (MASILLA)", unidad_medida: "ml", stock_minimo: 100, caduca: true },
    { id_insumo: 36, nombre: "SILICONA POR ADICIÓN (FLUIDA)", unidad_medida: "ml", stock_minimo: 25, caduca: true },
    { id_insumo: 37, nombre: "ALGINATO EN POLVO", unidad_medida: "Gramo", stock_minimo: 200, caduca: true },
    { id_insumo: 38, nombre: "YESO PIEDRA DENTAL", unidad_medida: "Gramo", stock_minimo: 500, caduca: false },
    { id_insumo: 39, nombre: "POSTE DE FIBRA DE VIDRIO", unidad_medida: "Pieza", stock_minimo: 5, caduca: false },
  ];

  await Promise.all(
    insumosData.map((ins) =>
      prisma.insumo.upsert({
        where: { id_insumo: ins.id_insumo },
        update: {},
        create: {
          id_insumo: ins.id_insumo,
          nombre: ins.nombre,
          unidad_medida: ins.unidad_medida,
          stock_minimo: ins.stock_minimo,
          caduca: ins.caduca,
        },
      })
    )
  );
  console.log(`  ✓ ${insumosData.length} insumos`);

  // ─── 3. Empleados ────────────────────────────────────────────────────────
  console.log("  Creando empleados...");
  await prisma.empleado.upsert({
    where: { id_empleado: 1 },
    update: {},
    create: {
      id_empleado: 1,
      nombre: "María Elena Soto",
      direccion: "Av. Universidad #102, Tijuana",
      correo_electronico: "maria.soto@uabc.edu.mx",
      numero_telefonico: "6641234567",
      puesto: "Almacenista",
      horario: "07:00 - 15:00",
    },
  });

  await prisma.empleado.upsert({
    where: { id_empleado: 2 },
    update: {},
    create: {
      id_empleado: 2,
      nombre: "Carlos Méndez Ruiz",
      direccion: "Blvd. Ensenada #450, Tijuana",
      correo_electronico: "carlos.mendez@uabc.edu.mx",
      numero_telefonico: "6649876543",
      puesto: "Encargado de Ventanilla",
      horario: "14:00 - 21:00",
    },
  });

  // ─── 4. Usuario admin de sistema ─────────────────────────────────────────
  console.log("  Creando usuario administrador...");
  const passwordHash = await bcrypt.hash("Admin123!", 12);
  await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      id_empleado: 1,
      username: "admin",
      password_hash: passwordHash,
      rol: "administrador",
      activo: true,
    },
  });

  const almacenistaHash = await bcrypt.hash("Almacen456!", 12);
  await prisma.usuario.upsert({
    where: { username: "almacen" },
    update: {},
    create: {
      id_empleado: 2,
      username: "almacen",
      password_hash: almacenistaHash,
      rol: "almacenista",
      activo: true,
    },
  });

  console.log("  ✓ Usuarios del sistema (admin / almacen)");

  // ─── 5. Estudiantes ──────────────────────────────────────────────────────
  console.log("  Creando estudiantes...");
  await prisma.estudiante.upsert({
    where: { no_control: "1289456" },
    update: {},
    create: {
      no_control: "1289456",
      nombre: "Juan Pablo Morales",
      correo_electronico: "juan.morales@uabc.edu.mx",
      numero_telefonico: "6645550199",
    },
  });
  await prisma.estudiante.upsert({
    where: { no_control: "1290342" },
    update: {},
    create: {
      no_control: "1290342",
      nombre: "Sofía Ramírez Leyva",
      correo_electronico: "sofia.ramirez@uabc.edu.mx",
      numero_telefonico: "6645550288",
    },
  });

  // ─── 6. Lotes de entrada (DML base) ──────────────────────────────────────
  console.log("  Creando lotes iniciales...");
  const lotesData = [
    { id: 1, insumo: 1, cad: "2028-06-30", cant: 50, emp: 1, prov: "Depósito Dental Odontomex" },
    { id: 2, insumo: 2, cad: "2029-01-15", cant: 100, emp: 1, prov: "Depósito Dental Odontomex" },
    { id: 3, insumo: 3, cad: "2028-11-20", cant: 200, emp: 1, prov: "Quirúrgicos del Noroeste" },
    { id: 4, insumo: 4, cad: "2028-04-10", cant: 100, emp: 1, prov: "Comercializadora Médica" },
    { id: 5, insumo: 9, cad: "2029-05-01", cant: 50, emp: 1, prov: "Quirúrgicos del Noroeste" },
    { id: 6, insumo: 10, cad: "2029-08-30", cant: 100, emp: 1, prov: "Quirúrgicos del Noroeste" },
    { id: 7, insumo: 11, cad: "2028-12-15", cant: 36, emp: 1, prov: "Quirúrgicos del Noroeste" },
    { id: 8, insumo: 12, cad: "2027-10-31", cant: 500, emp: 1, prov: "Comercializadora Médica" },
    { id: 9, insumo: 13, cad: "2028-03-15", cant: 24, emp: 1, prov: "Dental Distribuidora Baja" },
    { id: 10, insumo: 14, cad: "2027-08-01", cant: 2, emp: 1, prov: "Dental Distribuidora Baja" },
    { id: 11, insumo: 16, cad: "2027-12-31", cant: 10, emp: 2, prov: "3M Dental México" },
    { id: 12, insumo: 17, cad: "2027-09-30", cant: 5, emp: 2, prov: "3M Dental México" },
    { id: 13, insumo: 18, cad: "2027-11-15", cant: 8, emp: 1, prov: "3M Dental México" },
    { id: 14, insumo: 19, cad: "2027-07-20", cant: 5, emp: 1, prov: "Dental Distribuidora Baja" },
    { id: 15, insumo: 21, cad: "2028-02-28", cant: 4, emp: 1, prov: "Depósito Dental Odontomex" },
    { id: 16, insumo: 23, cad: "2027-05-15", cant: 3, emp: 1, prov: "Dental Distribuidora Baja" },
    { id: 17, insumo: 24, cad: "2027-04-30", cant: 36, emp: 1, prov: "Quirúrgicos del Noroeste" },
    { id: 18, insumo: 26, cad: "2027-09-01", cant: 1000, emp: 1, prov: "Comercializadora Médica" },
    { id: 19, insumo: 27, cad: "2029-03-31", cant: 200, emp: 1, prov: "Dental Distribuidora Baja" },
    { id: 20, insumo: 28, cad: "2029-06-30", cant: 120, emp: 1, prov: "Dental Distribuidora Baja" },
    { id: 21, insumo: 29, cad: "2027-08-31", cant: 5, emp: 1, prov: "Depósito Dental Odontomex" },
    { id: 22, insumo: 30, cad: "2027-06-30", cant: 30, emp: 2, prov: "Depósito Dental Odontomex" },
    { id: 23, insumo: 32, cad: "2028-10-15", cant: 100, emp: 2, prov: "Dental Distribuidora Baja" },
    { id: 24, insumo: 33, cad: "2028-10-15", cant: 125, emp: 2, prov: "Dental Distribuidora Baja" },
    { id: 25, insumo: 35, cad: "2027-11-30", cant: 2, emp: 1, prov: "3M Dental México" },
    { id: 26, insumo: 36, cad: "2027-11-30", cant: 4, emp: 1, prov: "3M Dental México" },
    { id: 27, insumo: 37, cad: "2027-12-15", cant: 454, emp: 1, prov: "Depósito Dental Odontomex" },
  ];

  await Promise.all(
    lotesData.map((l) =>
      prisma.lote.upsert({
        where: { id_lote: l.id },
        update: {},
        create: {
          id_lote: l.id,
          id_insumo: l.insumo,
          fecha_caducidad: new Date(l.cad),
          cantidad_ingresada: l.cant,
          estado: "activo",
          id_empleado: l.emp,
          proveedor: l.prov,
        },
      })
    )
  );
  console.log(`  ✓ ${lotesData.length} lotes`);

  console.log("✅ Seed completado exitosamente.");
  console.log("");
  console.log("Credenciales de acceso:");
  console.log("  Usuario: admin      | Contraseña: Admin123!    | Rol: administrador");
  console.log("  Usuario: almacen    | Contraseña: Almacen456!  | Rol: almacenista");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
