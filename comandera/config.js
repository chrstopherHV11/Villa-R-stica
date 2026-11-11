// Conexión con Supabase (la misma que usan las apps de la página web).
// La clave es la "publishable": es pública y ya va en el navegador de los clientes.
// Lo que protege los datos son las políticas RLS de la migración 03.
// Para probar sin servidor, abre cualquier pantalla con ?demo al final de la dirección.
window.VR_CONFIG = {
  url: 'https://xbnlghelucmnsufsojdi.supabase.co',
  key: 'sb_publishable_dVQKUqy-cGEYUpf39zIA2w_aohODfRR',
};
