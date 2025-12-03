# Database schemas
Here live the ER schemas as (should be) implemented in the database version of the current branch. They are documented as Mermaid.js files (see [ER Syntax](https://mermaid.js.org/syntax/entityRelationshipDiagram.html#syntax) for documentation).

```mermaid
---
title: PocketBase Schema
---
erDiagram
    direction LR
    USER{
        string id PK
        string username
        string email
        date created
        date updated
    }

    ITEM{
        string id PK
        string name
        Image image
        string description
        string place
        User field FK
        date created
        date updated
    }

    USER 1 to zero or more ITEM: owns

    MESSAGE{
        string id PK
        string messageContent
        id from FK
        id to FK
        date created
        date updated
    }

    USER 1 to 1 MESSAGE: "from"
    USER 1 to 1 MESSAGE: "to"

```