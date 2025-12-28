# Data Model

Here live the ER schemas as (should be) implemented in the database version of the current branch.

# Main Schema

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
        User[] trusts FK
    }
    USER 1 to zero or more USER: "trusts"

    ITEM{
        string id PK
        string name
        Image image
        string description
        string place
        User owner FK
        date created
        date updated
        bool trusteesOnly
    }

    USER 1 to zero or more ITEM: owns

    CONVERSATION{
        string id PK
        id requester FK
        id itemOwner FK
        id requestedItem FK
        Message[] messages
        bool readByRequester
        bool readByOwner
        date created
        date updated
    }

    USER 1 to zero or more CONVERSATION: has
    CONVERSATION zero or more to 1 ITEM: concerns

    MESSAGE{
        string id PK
        id conversation FK
        string messageContent
        id from FK
        id to FK
        date created
        date updated
    }
    
    CONVERSATION 1 to zero or more MESSAGE: contains

```
