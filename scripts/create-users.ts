import bcryptjs from 'bcryptjs';

async function main() {
  const usuarios = [
    {
      nombre: 'Francesca Espinosa',
      correo: 'francesca.espinosa@homelab.cl',
      rol: 'usuario'
    },
    {
      nombre: 'Sergio Espinosa',
      correo: 'sergioespinosa@homelab.cl',
      rol: 'usuario'
    },
    {
      nombre: 'Gustavo Arzola',
      correo: 'gustavo.arzola@gmail.com',
      rol: 'admin'
    },
    {
      nombre: 'Rino',
      correo: 'contacto@homelab.cl',
      rol: 'usuario'
    }
  ];

  const generarPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    for (let i = 0; i < 20; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const usariosConHash = await Promise.all(
    usuarios.map(async (u) => {
      const password = generarPassword();
      const hash = await bcryptjs.hash(password, 10);
      return {
        ...u,
        password,
        hash
      };
    })
  );

  console.log('='.repeat(80));
  console.log('CREDENCIALES DE USUARIOS (guardar en lugar seguro)');
  console.log('='.repeat(80));
  usariosConHash.forEach((u) => {
    console.log(`\n${u.nombre}`);
    console.log(`  Email: ${u.correo}`);
    console.log(`  Password: ${u.password}`);
    console.log(`  Rol: ${u.rol}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('SQL INSERT STATEMENTS');
  console.log('='.repeat(80));
  usariosConHash.forEach((u) => {
    console.log(`INSERT INTO usuarios (nombre, correo, contrasena, rol, activo, created_at, updated_at) VALUES ('${u.nombre.replace(/'/g, "''")}', '${u.correo}', '${u.hash}', '${u.rol}', true, NOW(), NOW());`);
  });
}

main().catch(console.error);
