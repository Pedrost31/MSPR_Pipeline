# Diagrammes MSPR

Ce document contient les 3 diagrammes demandes pour la soutenance :

1. Diagramme de flux de donnees (DFD)
2. Diagramme d'architecture technique
3. Diagrammes UML (classes + sequence)

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

## 3) UML

### 3.1 Diagramme de classes (modele metier)

```mermaid
classDiagram
    class Utilisateur {
        +Long user_id
        +int age
        +String gender
        +int experience_level
        +decimal weight_kg
        +decimal height_m
        +decimal bmi_calculated
    }

    class ActiviteJournaliere {
        +Long id_activity
        +Date date
        +int steps
        +decimal total_distance
        +decimal session_duration_hours
        +int calories_burned
    }

    class ActiviteIntensite {
        +Long id_intensite
        +String niveau_intensite
        +decimal distance
        +int minutes
    }

    class Nutrition {
        +int nutrition_id
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
        +String meal_type
        +int water_intake_ml
    }

    class ConsommationAlimentaire {
        +Long id_consumption
        +Date date_consommation
        +String repas_type
        +decimal quantite_grammes
    }

    class Workout {
        +int id_workout
        +String workout_type
    }

    Utilisateur "1" --> "0..*" ActiviteJournaliere : possede
    ActiviteJournaliere "1" --> "1..*" ActiviteIntensite : decompose
    Workout "1" --> "0..*" ActiviteJournaliere : categorise
    Utilisateur "1" --> "0..*" ConsommationAlimentaire : consomme
    Nutrition "1" --> "0..*" ConsommationAlimentaire : reference
```

### 3.2 Diagramme de sequence (requete dashboard)

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant A as API REST
    participant DB as PostgreSQL

    U->>D: Ouvre la page KPI
    D->>A: GET /kpi/daily-summary?user_id=...
    A->>DB: SELECT activite + consommation + nutrition
    DB-->>A: Resultats agreges
    A-->>D: JSON KPI
    D-->>U: Affichage des indicateurs
```

