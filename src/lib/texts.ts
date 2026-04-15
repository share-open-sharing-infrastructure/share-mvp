export const ITEM_CATEGORIES = [
	'Freizeit und Sport',
	'Werkzeug und Garten',
	'Bücher',
	'Spiele',
	'Küche',
	'Ton und Licht',
	'Elektronik',
	'Für Kinder',
	'Sonstiges',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const texts = {
	names: {
		app: 'AllerLeih',
		mainContactMail: 'allerleih@posteo.de',
	},

	// Authentication
	auth: {
		emailPlaceholder: 'E-Mail Adresse',
		passwordPlaceholder: '••••••••••',
		usernamePlaceholder: 'z.B. NoahLüni',
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
		notifications: 'Benachrichtigungen',
		myItems: 'Meine Dinge',
		myProfile: 'Mein Profil',
		social: 'Vertraute',
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
		conversationNotFound: 'Unterhaltung wurde nicht gefunden.',
		loginFailed: 'Login fehlgeschlagen.',
		usernameNoSpaces: 'Nutzername darf keine Leerzeichen enthalten.',
		emailAlreadyTaken: 'Diese E-Mail-Adresse wird bereits verwendet.',
		usernameRequired: 'Bitte gib einen Nutzernamen ein.',
		usernameTaken: 'Dieser Nutzername ist bereits vergeben.',
		passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
		invalidTelegramUsername: 'Ungültiger Telegram-Nutzername. Bitte gib nur den Namen ohne Sonderzeichen ein.',
		invalidSignalLink: 'Ungültiger Signal-Link. Signal-Links sollten mit "signal.me/" beginnen.',
		feedbackFailed: 'Feedback konnte nicht gesendet werden.',
	},

	// Success messages
	success: {
		changesSaved: 'Die Änderungen wurden gespeichert!',
		usernameAvailable: 'Nutzername ist verfügbar.',
		loggedOut: 'Erfolgreich ausgeloggt',
		passwordResetSent:
			'Falls diese E-Mail zu einem Account passt, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet!',
		dataUpdated: 'Daten wurden erfolgreich aktualisiert.',
		feedbackSent: 'Feedback erfolgreich gesendet. Vielen Dank!',
	},

	// Messenger contact
	messenger: {
		telegram: 'Telegram',
		signal: 'Signal',
		introText:
			'Du kannst deine Kontaktdaten für Signal und Telegram hinzufügen, um anderen Nutzern:innen die Möglichkeit zu geben, dich über diese Dienste zu kontaktieren, ohne deine Telefonnummer zu teilen.',
		telegramUsername: 'Telegram Nutzername',
		telegramUsernamePlaceholder: 'z.B. @meinname',
		signalLink: 'Signal-Link',
		signalLinkPlaceholder: 'z.B. signal.me/#p/...',
		telegramTooltipTitle: 'Telegram Nutzername hinzufügen',
		telegramTooltipText:
			'Dein Telegram-Nutzername findest du in der Telegram App unter Einstellungen > Nutzername. Kopiere nur den Namen ohne das @ Zeichen.',
		signalTooltipTitle: 'Signal-Link hinzufügen',
		signalTooltipText:
			'In der Signal App kannst du einen teilbaren Link unter Einstellungen > Profil > Namen/Profillink erstellen. Kopiere den kompletten Link in dieses Feld.',
		visibleToTrustedOnly: 'Nur Vertrauten zeigen',
		contactViaTelegram: 'Telegram',
		contactViaSignal: 'Signal',
		onlyForTrusted: 'Nur für Vertraute sichtbar',
	},

	// Form labels and placeholders
	forms: {
		username: 'Nutzername',
		location: 'Standort/Postleitzahl',
		itemName: 'Name des Gegenstands',
		itemDescription: 'Beschreibe den Gegenstand, z.B. Zustand, Marke, Größe oder was sonst noch wichtig sein könnte.',
		itemPlace: 'Ort des Gegenstands',
		searchPlaceholder: 'Suche Dinge...',
		messagePlaceholder: 'Tippe deine Nachricht...',
		trustPlaceholder: 'Ich vertraue...',
		newEmail: 'Deine neue E-Mail Adresse:',
		email: 'E-Mail eingeben',
		firstName: 'Vorname',
		password: 'Dein Passwort',
		secret: 'Geheimnis',
		place: 'Ort',
		addImage: 'Bild hinzufügen:',
		changeImage: 'Bild ändern:',
		description: 'Beschreibung:',
		itemCategories: 'Kategorien (max. 3):',
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
		newsletter: 'Für Newsletter registrieren',
		search: 'Suchen',
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
		chooseFromList: 'Wähle eine Anfrage aus der Liste links.',
		registeredSince: 'Registriert seit:',
		emailAddress: 'Mailadresse:',
		here: 'hier',
		welcome: 'Willkommen bei AllerLeih',
		welcomeShort: 'Willkommen!',
		welcomeBack: 'Willkommen zurück!',
		profileTitle: 'Dein Profil',
		location: 'Deine Adresse:',
		username: 'Nutzername:',
		contact: 'Kontaktieren',
		trustFunction: 'Vertrauensfunktion',
		trustDescription:
			'Du siehst diesen Gegenstand nur, weil deren Besitzer:in dir vertraut. Füge auch Du Kontakte hinzu, um liebgewonnene Dinge nur mit Vertrauten zu teilen.',
		trustLink: 'Vertrauensfunktion',
		trustedPeople: 'Vertraute Personen',
		trustedByPeople: 'Personen, die dir vertrauen',
		noOneTrustsYet: 'Noch vertraut dir niemand.',
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

	// Item status
	itemStatus: {
		available: 'Verfügbar',
		unavailable: 'Nicht verfügbar',
		markAvailable: 'auf "Verfügbar" setzen',
		markUnavailable: 'auf "Nicht verfügbar" setzen',
	},

	// Pages
	pages: {
		landing: {
			tagline: 'Leihe und teile Dinge in',
			ctaButtonSearch: 'Suche nach Dingen',
			ctaButtonUpload: 'Biete selbst etwas an',
			city: 'Lüneburg.',
			lendButton: 'Gegenstände verleihen',
			or: 'oder',
			registerCta: 'um Gegenstände anzubieten.',
			how: 'Wie funktioniert das?',
			who: 'Wer sind wir?',
			support: 'Was passiert gerade?'
		},
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
			title: 'Suche',
			welcome: 'Nutze einfach die Suche oben oder',
			description:
				'Bei AllerLeih findest du allerlei Dinge aus deiner Umgebung zum leihen, teilen, mieten, ...',
			transportModes: {
				foot: 'Zu Fuß',
				bicycle: 'Fahrrad',
				car: 'Auto',
			},
			noLocation:
				'Setze deinen Standort in deinem Profil, um Reisezeiten zu sehen.',
			minutesAway: (n: number) => `${n} min`,
			durationFilter: {
				noLimit: 'Beliebig',
				maxMinutes: (n: number) => `max. ${n} Min.`,
				paginationHidden:
					'Entfernungsfilter aktiv – nur die aktuelle Seite wird gefiltert. Setze das Limit auf „Beliebig", um alle Seiten zu sehen.',
			},
			categoryFilterAnd: 'Alle Kategorien erfüllen (UND-Filter)',
			perPage: 'Pro Seite:',
			pageInfo: (current: number, total: number) => `Seite ${current} von ${total}`,
			browseAll: 'Alle Gegenstände anzeigen',
		},
		logout: {
			message: 'Ausloggen...',
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
			title: 'Anfragen',
			lending: 'Verleihen',
			borrowing: 'Ausleihen',
			noLendingConversations: 'Keine Anfragen für deine Sachen.',
			noBorrowingConversations: 'Du hast noch nichts angefragt.',
		},
		items: {
			title: 'Meine Dinge',
			countSome: (n: number) => `Du verleihst ${n} Ding(e)...`,
			countNone: 'Du verleihst noch keine Ding(e)...',
			addSingle: 'Dinge einzeln hochladen',
			addBulk: 'KI-gestützt mehrere Dinge gleichzeitig hochladen',
		},
		profile: {
			title: 'Mein Profil',
		},
		invite: {
			sectionTitle: 'Freunde einladen',
			description: 'Teile diesen Link, um Freunde einzuladen. Alle, die sich darüber registrieren, werden dir und du ihnen automatisch vertrauen.',
			copyButton: 'Link kopieren',
			copied: 'Link kopiert!',
			welcomeMessage: (username: string) => `Du wurdest von ${username} eingeladen.`,
			noInvite: 'Du benötigst einen Einladungslink, um dich zu registrieren.',
			invalidInvite: 'Dieser Einladungslink ist ungültig.',
		},
		itemDetail: {
			backToSearch: '← Zurück zur Suche',
			requestButton: 'Anfragen',
			trustRestrictedTooltip: 'Dieser Gegenstand wird nur an vertraute Nutzer verliehen.',
			locationLabel: 'Ort',
			noImage: 'Kein Bild vorhanden',
		},
		userProfile: {
			activeSince: (date: string) => `Aktiv seit ${date}`,
			trustsYou: 'Diese Person vertraut dir.',
			doesNotTrustYou: 'Diese Person vertraut dir (noch) nicht.',
			trustsThisUser: 'Du vertraust diesem Account',
			doesNotTrustThisUser: 'Du vertraust diesem Account (noch) nicht.',
			publicItems: 'Öffentliche Gegenstände',
			trustedItems: 'Nur für Vertraute',
			noPublicItems: 'Diese Person bietet noch keine Gegenstände an.',
			notTrustedNote: 'Diese Person verleiht weitere Gegenstände nur an vertraute Nutzer.',
			addressNote: 'AllerLeih nutzt deine Adresse, um dir und anderen Nutzer:innen die Reisezeit zueinander anzuzeigen. Wir geben deine Adresse nicht nach außen. Du kannst auch nur eine ungefähre Adresse angeben oder das Feld leer lassen. Je genauer du die Adresse angibst, desto genauer können die Reisezeiten berechnet werden.',
		},
	},

	// Bulk photo upload / AI item recognition
	bulkUpload: {
		buttonLabel: 'KI-gestützt Fotos hochladen',
		pageTitle: 'Mehrere Dinge mit KI hinzufügen',
		dropzoneLabel: 'Weitere Fotos hinzufügen oder hierher ziehen',
		disclaimer: 'Lade pro Gegenstand genau EIN Foto hoch. Sorge für gute Beleuchtung und einen aufgeräumten Hintergrund – so erkennt die KI den Gegenstand am besten.',
		selectFiles: 'Fotos auswählen',
		mobileTip: 'Tipp für Handys: Nimm alle Fotos zuerst mit der Kamera-App auf, und wähle sie danach hier auf einmal aus der Galerie aus.',
		filesSelected: (n: number) => `${n} Foto(s) ausgewählt`,
		continue: 'KI-Analyse starten',
		analyzing: 'Wird erkannt…',
		analysisError: 'Erkennung fehlgeschlagen – bitte manuell ausfüllen',
		reviewTitle: 'Prüfe die von der KI erkannten Dinge! Die KI kann Fehler machen, also korrigiere die Angaben bei Bedarf.',
		removeItem: 'Entfernen',
		createAll: (n: number) => `Alle erstellen (${n})`,
		creating: 'Wird erstellt…',
		noPhotosSelected: 'Bitte wähle mindestens ein Foto aus.',
		howItWorksHeader: 'Wie funktioniert das?',
		howItWorksBody: 'Die KI erkennt deine Gegenstände und schlägt dir Titel, Kategorie(n) und Beschreibung vor. \
			Das spart dir Zeit — kostet aber pro Bild etwas Strom (ca. 1–3 Wattstunden), Wasser (ca. 5–30 Milliliter), CO₂ (ca. 0,1–0,3 Gramm) und basiert auf einer Industrie mit ethischen Problemen.\
			Wir bieten diese Option an, weil sie das Hochladen von Gegenständen stark vereinfacht und somit den Verleih fördert.\
			Mistral nutzt diese Bilder unter Umständen zur Verbesserung ihrer KI, also lade keine Fotos hoch, die du nicht teilen möchtest. \
			Alle Analysen finden auf den Servern von Mistral in Frankreich nach europäischem und französischem Recht statt, wir haben keinen Einfluss darauf.',
	},
	
	// Onboarding
	onboarding: {
		welcome: {
			title: 'Willkommen bei AllerLeih!',
			subtitle:
				'Die Plattform zum Teilen und Ausleihen von Dingen – mit Freund:innen, deiner Nachbarschaft oder neuen Bekannten in deiner Umgebung.',
			ethos: 'Gemeinwohlorientiert und open-source.',
		},
		howItWorks: {
			title: "So funktioniert's",
			search: 'Stöbere in Gegenständen aus deiner Umgebung und frage direkt an, was du brauchst.',
			share: 'Stelle Gegenstände ein, die du verleihen möchtest – von der Bohrmaschine bis zum Buch.',
			trust:
				'Baue ein Vertrauensnetzwerk auf und teile bestimmte Dinge nur mit ausgewählten Personen.',
			contact:
				'Kontaktiere andere direkt über Telegram oder Signal – ohne deine Telefonnummer zu teilen.',
		},
		location: {
			title: 'Wo bist du?',
			explanation:
				'AllerLeih nutzt deine Adresse, um dir und anderen die Reisezeit zueinander anzuzeigen. Deine Adresse wird nicht öffentlich angezeigt. Du kannst auch nur einen ungefähren Ort angeben oder das Feld überspringen.',
		},
		contact: {
			title: 'Wie kann man dich erreichen?',
			explanation:
				'Füge deinen Telegram-Nutzernamen oder Signal-Link hinzu, damit andere dich bei Interesse direkt kontaktieren können – ganz ohne Telefonnummer. Das ist natürlich optional, du kannst auch über AllerLeih kontaktiert werden, ohne diese Informationen anzugeben.',
			notificationsTitle: 'Benachrichtigungen',
			notificationsNote: 'Kommt bald',
			inApp: 'In-App Benachrichtigungen',
			email: 'E-Mail Benachrichtigungen',
		},
		trustees: {
			title: 'Wem vertraust du?',
			explanation:
				'Füge Personen hinzu, denen du vertraust. Du kannst dann bestimmte Gegenstände nur für sie sichtbar machen.',
			searchPlaceholder: 'Nutzername suchen...',
			noResults: 'Keine Personen gefunden.',
			noTrusteesYet: 'Noch niemanden hinzugefügt.',
		},
		browserLocation: {
			title: 'Standort freigeben?',
			explanation:
				'AllerLeih kann deinen aktuellen GPS-Standort nutzen, um dir Dinge in deiner unmittelbaren Nähe anzuzeigen. Dein Standort wird dabei nicht gespeichert.',
			allow: 'Standort freigeben',
			denied: 'Standort konnte nicht abgerufen werden.',
		},
		pushNotifications: {
			title: 'Benachrichtigungen aktivieren?',
			explanation:
				'Erhalte eine Benachrichtigung, wenn jemand deine Dinge anfragen oder dir schreiben. Du kannst das jederzeit in den Browser-Einstellungen ändern.',
			allow: 'Benachrichtigungen aktivieren',
		},
		done: {
			title: 'Alles bereit! 🎉',
			subtitle: 'Schön, dass du dabei bist. Womit möchtest du loslegen?',
			searchCta: 'Dinge suchen',
			uploadCta: 'Dinge anbieten',
			inviteCta: 'Freunde einladen',
		},
		buttons: {
			next: 'Weiter',
			skip: 'Überspringen',
			finish: "Los geht's!",
		},
	},

	// Notifications
	notifications: {
		title: 'Benachrichtigungen',
		empty: 'Keine Benachrichtigungen',
		newMessage: (from: string) => `Neue Nachricht von ${from}`,
		newRequest: (from: string, item: string) => `${from} möchte „${item}" ausleihen`,
		trustAdded: (from: string) => `${from} vertraut dir jetzt`,
		pushTitle: 'AllerLeih',
		inviteAccepted: (username: string) => `${username} hat deinen Einladungslink genutzt – nutze die "Vertrauen"-Funktion um dich mit der Person zu verbinden.`,
	},

	// PWA install and notification prompts
	pwa: {
		notifBannerText: 'Erhalte Benachrichtigungen für neue Nachrichten und Anfragen.',
		notifEnable: 'Aktivieren',
		notifDismiss: 'Später',
		installBannerText: 'Installiere AllerLeih für das beste Erlebnis.',
		installButton: 'Installieren',
		installDismiss: 'Nicht jetzt',
		installManualFirefox: 'Tippe auf ⋮ → „Zum Startbildschirm hinzufügen"',
		installManualIos: 'Tippe auf ⬆ → „Zum Home-Bildschirm"',
		installManualGeneric: 'Tippe im Browser-Menü auf „Zum Startbildschirm hinzufügen"',
	},

	// Flash messages and alerts
	alerts: {
		errorPrefix: 'Error:',
		successPrefix: 'Success:',
	},
};

