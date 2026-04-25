# Diagrammes MSPR

Ce document contient l'ensemble des diagrammes du projet HealthAI Coach :

1. Diagramme de flux de données (DFD)
2. Diagramme d'architecture technique
3. Diagramme d'activité — exécution du pipeline ETL
4. Diagramme de déploiement (Docker / infrastructure)
5. Diagrammes UML (classes + séquence)

---

## 1) Diagramme de flux de donnees (DFD)

```mermaid
flowchart LR
    A[data/raw<br/>Activity.csv<br/>gym_members_exercise_tracking.csv<br/>daily_food_nutrition_dataset.csv]
    B[Extract<br/>etl/extract.py]
    C[Transform<br/>etl/transform.py]
    D[Quality Check<br/>etl/quality.py]
    E[Load<br/>etl/load.py]
    F[data/processed<br/>users_clean.csv<br/>activity_clean.csv<br/>nutrition_clean.csv<br/>merged_analytics_mspr_20.csv<br/>consommation_alimentaire.csv]
    G[(PostgreSQL)]
    H[API REST]
    I[Dashboard / BI]

    A --> B --> C --> D --> E --> F --> G --> H --> I
```

---

## 2) Diagramme d'architecture technique

```mermaid
flowchart TB
    subgraph Sources
        S1[CSV bruts]
        S2[Open Data Nutrition]
    end

    subgraph Data_Engineering
        P1[Pipeline Python ETL]
        P2[Logs ETL]
        P3[Rapport qualite CSV]
    end

    subgraph Data_Storage
        DB[(PostgreSQL)]
    end

    subgraph Backend
        API[API REST securisee]
    end

    subgraph Frontend_Analytics
        DASH[Dashboard web / BI]
    end

    S1 --> P1
    S2 --> P1
    P1 --> P2
    P1 --> P3
    P1 --> DB
    DB --> API
    API --> DASH
```

---

## 3) Diagramme d'activité — exécution du pipeline ETL

Ce diagramme détaille le déroulement séquentiel du pipeline avec les points de décision et de contrôle qualité.

```mermaid
flowchart TD
    START([Démarrage run_pipeline]) --> EXTRACT

    subgraph EXTRACTION
        EXTRACT[Lecture CSV bruts\nextract.py]
        EXTRACT --> CHECK_EXTRACT{Extraction\nréussie ?}
        CHECK_EXTRACT -- Non --> LOG_ERR[Log erreur\nArrêt pipeline]
        CHECK_EXTRACT -- Oui --> CLEAN
    end

    subgraph TRANSFORMATION
        CLEAN[Nettoyage\nclean_users + clean_activity\n+ clean_nutrition]
        CLEAN --> FEAT[Feature engineering\nadd_user_features\nBMI_calculated]
        FEAT --> ALIGN[Alignement UserIDs\nalign_users_with_activity_ids\n33 profils → IDs Activity]
        ALIGN --> MERGE[Merge analytique\nactivity ⟕ users_for_merge]
        MERGE --> SORT[Tri par Date]
        SORT --> STD[Standardisation\narrondi 2 décimales]
        STD --> SELECT[Sélection 20 colonnes MSPR]
        SELECT --> CONSOMM[Simulation consommations\nbuild_consumption_data\n2-4 items/jour/utilisateur]
    end

    subgraph CHARGEMENT
        CONSOMM --> LOAD[Export 6 CSV\ndata/processed/]
        LOAD --> QUALITY[Rapport qualité\ncsv_quality_report.csv]
        QUALITY --> LOG_OK[Log succès\netl.log]
    end

    LOG_OK --> END([Fin])
    LOG_ERR --> END
```

---

## 4) Diagramme de déploiement

Vue de l'infrastructure complète du projet HealthAI Coach.

```mermaid
flowchart TB
    subgraph PIPELINE["Pipeline ETL (MSPR_Pipeline)"]
        direction TB
        RAW["data/raw/\n(CSV Kaggle)"]
        ETL["healthai-pipeline\nPython 3.9\nscripts/run_pipeline.py"]
        PROCESSED["data/processed/\n(merged_analytics_mspr_20.csv\nnutrition_clean.csv\nconsommation_alimentaire.csv\n...)"]
        LOGS["logs/\netl.log · csv_quality_report.csv"]
        SEED["database/seed.py\n--truncate"]

        RAW -->|volume monté| ETL
        ETL -->|écriture| PROCESSED
        ETL -->|écriture| LOGS
        PROCESSED -->|psycopg2| SEED
    end

    subgraph INFRA["Infrastructure Docker Compose"]
        direction TB
        DB[("healthai-postgres\nPostgreSQL 15\nPort 5432\ninit.sql + api_schema.sql")]
        API["APIMSPR-1\nNode.js / Express\nPort 3000\nJWT · httpOnly cookie"]
        DIST["public/dist/\nReact SPA buildée\n(servi statiquement par l'API)"]

        SEED -->|INSERT INTO healthai.*| DB
        DB <-->|pool pg| API
        API -->|express.static| DIST
    end

    subgraph CLIENT["Client"]
        BROWSER["Navigateur\nAdmin Panel · Dashboard User"]
    end

    DIST -->|HTTP/JSON| BROWSER
    BROWSER -->|requêtes API| API
```

**Note :** L'interface React (`client/src`) doit être compilée (`npm run build`) avant déploiement. Elle est ensuite servie par l'API Node.js depuis `public/dist/`.

---

## 5) UML

### 5.1 Diagramme de classes (modèle complet)

```mermaid
classDiagram
    class ApiUser {
        +int id PK
        +String email
        +String password_hash
        +String role
        +DateTime created_at
    }

    class Session {
        +int id PK
        +int user_id FK
        +String token
        +DateTime expires_at
    }

    class Utilisateur {
        +Long user_id PK
        +int age
        +String gender
        +int experience_level
        +decimal weight_kg
        +decimal height_m
        +decimal bmi_calculated
        +int api_user_id FK
    }

    class ActiviteJournaliere {
        +Long id_activity PK
        +Long user_id FK
        +Date date
        +String workout_type
        +int steps
        +decimal total_distance
        +decimal session_duration_hours
        +int calories_burned
    }

    class ActiviteIntensite {
        +Long id_intensite PK
        +Long id_activity FK
        +String niveau_intensite
        +decimal distance
        +int minutes
    }

    class Nutrition {
        +int nutrition_id PK
        +String food_item
        +String category
        +int calories_kcal
        +decimal protein_g
        +decimal carbohydrates_g
        +decimal fat_g
        +decimal fiber_g
        +decimal sugars_g
        +int sodium_mg
        +int cholesterol_mg
        +repas_type_t meal_type
        +int water_intake_ml
    }

    class ConsommationAlimentaire {
        +Long id_consumption PK
        +Long user_id FK
        +int nutrition_id FK
        +Date date_consommation
        +repas_type_t repas_type
        +decimal quantite_grammes
    }

    ApiUser "1" --> "0..*" Session : génère
    ApiUser "1" --> "0..1" Utilisateur : est lié à
    Utilisateur "1" --> "0..*" ActiviteJournaliere : possède
    ActiviteJournaliere "1" --> "4" ActiviteIntensite : décomposé en
    Utilisateur "1" --> "0..*" ConsommationAlimentaire : consomme
    Nutrition "1" --> "0..*" ConsommationAlimentaire : référencée dans
```

### 5.2 Diagramme de séquence — authentification JWT

```mermaid
sequenceDiagram
    participant U as Navigateur
    participant A as API Node.js
    participant DB as PostgreSQL

    U->>A: POST /auth/login {email, password}
    A->>DB: SELECT * FROM api_users WHERE email=$1
    DB-->>A: {id, email, password_hash, role}
    A->>A: bcrypt.compare(password, hash)
    A->>DB: INSERT INTO sessions (user_id, token, expires_at)
    A-->>U: Set-Cookie: token=JWT (httpOnly) + {role, email, id}

    Note over U,A: Requêtes suivantes — cookie envoyé automatiquement

    U->>A: GET /analytics/kpi
    A->>A: authenticate → vérifie JWT
    A->>DB: SELECT token FROM sessions WHERE token=$1
    DB-->>A: session valide
    A->>DB: SELECT user_id FROM utilisateur WHERE api_user_id=$1
    DB-->>A: healthId
    A->>DB: SELECT * FROM v_kpi_dashboard WHERE user_id=$1
    DB-->>A: KPI row
    A-->>U: JSON [{bmi_calculated, nb_seances, ...}]
```

### 5.3 Diagramme de séquence — requête analytics (admin)

```mermaid
sequenceDiagram
    participant AD as Admin
    participant A as API Node.js
    participant DB as PostgreSQL

    AD->>A: GET /analytics/resume (cookie JWT role=admin)
    A->>A: authenticate → role=admin
    A->>A: attachHealthId → ignoré (admin)
    A->>DB: SELECT * FROM v_resume_journalier ORDER BY user_id, date DESC
    DB-->>A: toutes les lignes (tous utilisateurs)
    A-->>AD: JSON array complet
```

### 5.4 Diagramme des vues analytiques

```mermaid
flowchart LR
    subgraph Tables["Tables source"]
        U[(utilisateur)]
        AJ[(activite_journaliere)]
        AI[(activite_intensite)]
        N[(nutrition)]
        CA[(consommation_alimentaire)]
    end

    subgraph Vues["Vues PostgreSQL (healthai.*)"]
        V1[v_profil_utilisateur]
        V2[v_resume_journalier]
        V3[v_bilan_calorique]
        V4[v_apport_nutritionnel]
        V5[v_intensite_seance]
        V6[v_kpi_dashboard]
    end

    subgraph Endpoints["GET /analytics/*"]
        E1[/profil]
        E2[/resume]
        E3[/bilan]
        E4[/apport]
        E5[/intensite]
        E6[/kpi]
    end

    U --> V1
    U & AJ --> V2
    U & AJ & N & CA --> V2
    V2 --> V3
    CA & N --> V4
    AJ & AI --> V5
    V1 & V2 --> V6

    V1 --> E1
    V2 --> E2
    V3 --> E3
    V4 --> E4
    V5 --> E5
    V6 --> E6
```

