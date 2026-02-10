export const texts = {
	// Authentication
	auth: {
		emailPlaceholder: 'E-Mail Adresse',
		passwordPlaceholder: '••••••••••',
		loginFailed: 'Login fehlgeschlagen.',
		resetPassword: 'Setze mein Passwort zurück!',
		register: 'Registrieren',
		forgotPassword: 'Passwort vergessen?',
		secretPlaceholder: 'Geheimes Codewort für den Test-Zugang',
		loginButton: 'Anmelden',
		registerLink: 'Registrieren',
	},

	// Navigation
	nav: {
		login: 'Login',
		register: 'Registrieren',
		search: 'Suche',
		requests: 'Anfragen',
		myItems: 'Meine Dinge',
		social: 'Soziales',
		logout: 'Logout',
		about: 'Über',
		imprint: 'Impressum',
		contact: 'Kontakt',
		newsletter: 'Newsletter',
	},

	// Error messages
	errors: {
		changesNotSaved: 'Die Änderungen konnten nicht gespeichert werden!',
		somethingWentWrong: 'Hupsi, da ist wohl was schiefgelaufen.',
		failedToCreateConversation: 'Failed to create conversation.',
		failedToSendMessage: 'Failed to send message.',
		failedToDeleteConversation: 'Failed to delete conversation.',
		loginFailed: 'Login fehlgeschlagen.',
		usernameNoSpaces: 'Nutzername darf keine Leerzeichen enthalten.',
		passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
	},

	// Success messages
	success: {
		changesSaved: 'Die Änderungen wurden gespeichert!',
		loggedOut: 'Logged out succesfully',
		passwordResetSent:
			'If this email exists, a password reset email has been sent!',
		dataUpdated: 'Daten wurden erfolgreich aktualisiert.',
	},

	// Form labels and placeholders
	forms: {
		username: 'Nutzername',
		location: 'Standort/Postleitzahl',
		itemName: 'Name des Gegenstands',
		itemDescription: 'Beschreibung des Gegenstands',
		itemPlace: 'Ort des Gegenstands',
		searchPlaceholder: 'Suche Dinge...',
		messagePlaceholder: 'Tippe deine Nachricht...',
		trustPlaceholder: 'Ich vertraue...',
		newEmail: 'Deine neue E-Mail Adresse:',
		email: 'E-Mail',
		firstName: 'Vorname',
		password: 'Dein Passwort',
		secret: 'Geheimnis',
		place: 'Ort',
		addImage: 'Bild hinzufügen:',
		changeImage: 'Bild ändern:',
		description: 'Beschreibung:',
	},

	// Buttons
	buttons: {
		add: 'Hinzufügen',
		save: 'Speichern',
		delete: 'Löschen',
		send: 'Senden',
		addImage: 'Bild hinzufügen:',
		changeImage: 'Bild ändern:',
		subscribe: 'Für Newsletter registrieren',
		updateEmail: 'Ändere meine Mailadresse',
		startChat: 'Starte ein Gespräch, indem du jemanden anschreibst!',
		goToSearch: 'Gehe dazu auf die',
		findItem: 'und finde einen Gegenstand.',
		offerSomething: 'Biete selbst etwas an!',
	},

	// General UI
	ui: {
		resultsFound: (count: number) => `${count} Dinge gefunden`,
		activeSince: (date: string) => `aktiv seit ${date}`,
		itemsLent: (count: number) => `${count} Dinge`,
		noItemsYet: 'Bisher verleihst du noch keine Gegenstände.',
		noChatsYet: 'Du hast noch keine Chats.',
		startConversation: 'Starte ein Gespräch, indem du jemanden anschreibst!',
		trustedOnly: 'Nur an Vertraute',
		explainThis: 'Erkläre mir das',
		chooseFromList: 'Wähle einen Chat aus der Liste links.',
		registeredSince: 'Registriert seit:',
		emailAddress: 'Mailadresse:',
		here: 'hier',
		welcome: 'Willkommen bei AllerLeih',
		welcomeShort: 'Willkommen!',
		welcomeBack: 'Willkommen zurück!',
		profileTitle: 'Dein Profil',
		location: 'Standort/Postleitzahl:',
		username: 'Nutzername:',
		contact: 'Kontaktieren',
		trustFunction: 'Vertrauensfunktion',
		trustDescription:
			'Du siehst diesen Gegenstand nur, weil deren Besitzer:in dir vertraut. Füge auch Du Kontakte hinzu, um liebgewonnene Dinge nur mit Vertrauten zu teilen.',
		trustLink: 'Vertrauensfunktion',
		trustedPeople: 'Vertraute Personen',
		trustDescriptionSocial:
			'Füge Menschen hinzu, denen du einen guten Umgang mit deinen Dingen',
		yourItemsLink: 'deine Dinge',
		revokeTrust: 'das Vertrauen entziehen',
		allRequests: 'Alle Anfragen',
		noRequestsYet:
			'Falls du noch keine Anfragen gestellt oder bekommen hast, nutze die',
		searchLink: 'Suche',
		findItems: 'und finde einen Gegenstand.',
	},

	// Pages
	pages: {
		about: {
			title: 'Über AllerLeih',
			description: 'von und für Freunde, Familie und die lokale Gemeinschaft',
		},
		contact: {
			title: 'Kontakt',
		},
		imprint: {
			title: 'Impressum',
		},
		howTo: {
			title: "Und so funktioniert's:",
		},
		search: {
			welcome: 'Nutze einfach die Suche oben oder',
			description:
				'Bei AllerLeih findest du allerlei Dinge aus deiner Umgebung zum leihen, teilen, mieten, ...',
		},
		logout: {
			message: 'Logging you out...',
		},
		social: {
			yourItems: 'deine Dinge',
		},
		reset: {
			title: 'Passwort zurücksetzen',
			emailLabel: 'Deine E-Mail Adresse',
			resetButton: 'Setze mein Passwort zurück!',
		},
		updatemail: {
			title: 'Mailadresse ändern',
			newEmailLabel: 'Deine neue E-Mail Adresse:',
			updateButton: 'Ändere meine Mailadresse',
		},
		register: {
			title: 'Registrieren',
		},
		conversations: {
			title: 'Chats',
		},
	},

	// Flash messages and alerts
	alerts: {
		errorPrefix: 'Error:',
		successPrefix: 'Success:',
	},
};

export type Texts = typeof texts;
