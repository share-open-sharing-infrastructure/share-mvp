The docs folder contains multiple files for conceptual documentation. In general, we want the code to be the documentation. In this folder live domain and data models for guidance during coding and conceptual extensions when implementing new features.

- [domain-model.md](domain-model.md) contains higher-level diagrams useful for conceptual understanding and work.
- [data-model.md](data-model.md) contains the ER diagram that maps directly onto the database structure.
- Actual TypeScript types live in [lib/types/models.ts](../lib/types/models.ts) (might eventually be broken up into separate files if useful).