export type Item = {
    id: string;
    collectionId: string;
    name: string;
    description: string;
    image: string;
    place: string;
    field: string;
    created: string;
    updated: string;
    expand?: {
        field: {
            id: string;
            username: string;
        };
    };
    // add any other fields from PocketBase
};