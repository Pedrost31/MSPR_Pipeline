/**
 * Tests unitaires pour la connexion API <-> Base de données
 * 
 * Usage: 
 *   npm test                    (test avec config .env)
 *   npm run test:docker         (test avec Docker PostgreSQL)
 * 
 * Note: Les tests utilisent les variables d'environnement du .env
 */
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config(); 

console.log('ENV DEBUG:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const { Pool } = pkg;

// Créer un pool avec les variables d'environnement
// Priorité: variables d'environnement > .env > valeurs par défaut
const pool = new Pool({
  connectionString: 'postgresql://healthai:healthai@localhost:5432/healthai',
});

describe('Connexion API - Base de données', () => {
  
  /**
   * Test 1: Vérifier que la connexion à la base de données fonctionne
   */
  test('devrait se connecter à la base de données', async () => {
    const client = await pool.connect();
    expect(client).toBeDefined();
    client.release();
  });

  /**
   * Test 2: Vérifier que le schéma healthai existe
   */
  test('devrait avoir accès au schéma healthai', async () => {
    const result = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'healthai'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  /**
   * Test 3: Vérifier que les tables principales existent
   */
  test('devrait avoir les tables principales', async () => {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'healthai'
      AND table_type = 'BASE TABLE'
    `);
    
    const tableNames = result.rows.map(row => row.table_name);
    
    // Tables attendues
    const expectedTables = [
      'utilisateur',
      'activite_journaliere',
      'activite_intensite',
      'nutrition',
      'consommation_alimentaire',
      'api_users',
      'sessions',
      'exercice'
    ];
    
    expectedTables.forEach(table => {
      expect(tableNames).toContain(table);
    });
  });

  /**
   * Test 4: Vérifier qu\'on peut exécuter une requête simple
   */
  test('devrait pouvoir exécuter une requête SELECT', async () => {
    const result = await pool.query('SELECT 1 as test');
    expect(result.rows[0].test).toBe(1);
  });

  /**
   * Test 5: Vérifier la configuration de la base de données
   */
  test('devrait avoir une configuration valide', async () => {
    expect(process.env.DB_HOST).toBeDefined();
    expect(process.env.DB_PORT).toBeDefined();
    expect(process.env.DB_NAME).toBeDefined();
    expect(process.env.DB_USER).toBeDefined();
  });

  /**
   * Test 6: Vérifier qu\'on peut lire des données des utilisateurs
   */
  test('devrait pouvoir lire les utilisateurs', async () => {
    const result = await pool.query('SELECT COUNT(*) as count FROM healthai.utilisateur');
    expect(result.rows[0].count).toBeDefined();
  });

  /**
   * Test 7: Vérifier la table api_users
   */
  test('devrait avoir accès à la table api_users', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'api_users'
      ORDER BY ordinal_position
    `);
    
    const columns = result.rows.map(row => row.column_name);
    expect(columns).toContain('email');
    expect(columns).toContain('password_hash');
    expect(columns).toContain('role');
  });

  /**
   * Test 8: Vérifier les contraintes de la table utilisateur
   */
  test('devrait avoir les contraintes sur utilisateur', async () => {
    const result = await pool.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'healthai.utilisateur'::regclass
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  /**
   * Test 9: Vérifier les index sur activite_journaliere
   */
  test('devrait avoir des index sur activite_journaliere', async () => {
    const result = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'activite_journaliere'
      AND schemaname = 'healthai'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  /**
   * Test 10: Vérifier la vue v_profil_utilisateur
   */
  test('devrait avoir les vues analytiques', async () => {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'healthai'
    `);
    
    const viewNames = result.rows.map(row => row.table_name);
    expect(viewNames).toContain('v_profil_utilisateur');
    expect(viewNames).toContain('v_kpi_dashboard');
  });

  /**
   * Nettoyage après les tests
   */
  afterAll(async () => {
    await pool.end();
  });
});