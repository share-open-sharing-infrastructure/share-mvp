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
		mainContactMail: 'kontakt@allerleih.org',
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
		privacyConsentLabel: 'Ich habe die Datenschutzerklärung gelesen und stimme ihr zu.',
	},

	// Navigation
	nav: {
		login: 'Login',
		register: 'Registrieren',
		search: 'Suche',
		requests: 'Unterhaltungen',
		notifications: 'Benachrichtigungen',
		myItems: 'Meine Dinge',
		myProfile: 'Mein Profil',
		social: 'Vertraute',
		logout: 'Logout',
		about: 'Über uns',
		imprint: 'Impressum',
		contact: 'Kontakt',
		newsletter: 'Newsletter',
		faq: 'FAQ',
		translate: 'Translate',
		translateTitle: 'Translate this page',
		translateBrowser: "Your browser can translate this page automatically — look for the translate icon in your address bar, or right-click and select 'Translate'. Or:",
		translateDeepL: 'Translate text with DeepL',
		guide: "Wie funktioniert's?",
		privacy: 'Datenschutz',
		tos: 'AGB',
	},

	// Footer
	footer: {
		instagram: 'AllerLeih auf Instagram',
		mastodon: 'AllerLeih auf Mastodon',
		pixelfed: 'AllerLeih auf PixelFed',
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
		userConsentRequired: 'Bitte stimme der Datenschutzerklärung und den AGB zu, um fortzufahren.',
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
		trusteeAdded: (username: string) => `${username} wurde deinem Netzwerk hinzugefügt.`,
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
		trustedOnly: 'Nur Vertraute',
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
		trustedPeople: 'Vertrauensnetzwerk',
		trustedByPeople: 'Personen, die dir vertrauen',
		noOneTrustsYet: 'Noch vertraut dir niemand.',
		trustDescriptionSocial:
			'Füge Menschen hinzu, denen du einen guten Umgang mit deinen Dingen',
		yourItemsLink: 'deine Dinge',
		revokeTrust: 'das Vertrauen entziehen',
		trustNetworkEmpty: 'Noch keine Verbindungen. Füge Kontakte hinzu!',
		trustMutual: 'Gegenseitig',
		youTrustThem: 'Du vertraust',
		theyTrustYou: 'Vertraut dir',
		trustBack: 'Auch vertrauen',
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
			ctaButtonSearch: 'Dinge Finden',
			ctaButtonUpload: 'Dinge Verleihen',
			city: 'Lüneburg',
			lendButton: 'Gegenstände verleihen',
			or: 'oder',
			registerCta: 'um Gegenstände anzubieten.',
			welcome: 'Willkommen bei',
			how: 'Wie funktioniert das?',
			howLinkText: 'Hier',
			howBodyPart1: 'geben wir dir eine kurze Einführung, wie du',
			howBodyPart2: 'nutzen kannst, um Dinge in deiner Umgebung zu leihen oder zu verleihen.',
			who: 'Wer sind wir?',
			whoBodyPart1: 'Wir sind eine gemeinnützige Initiative aus Lüneburg. Du kannst uns jederzeit',
			whoLinkText: 'kontaktieren',
			whoBodyPart2: ', wenn du Fragen hast oder uns unterstützen willst!',
			support: 'Was passiert gerade?',
			supportBodyPart1: 'Wir befinden uns derzeit in einer Testphase mit einer kleinen Gruppe von Nutzer:innen. Wenn du Interesse hast, an diesem Test teilzunehmen,',
			supportLinkText: 'melde dich bei uns'
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
		faq: {
			title: 'Häufige Fragen (FAQ)',
		},
		howTo: {
			title: "Und so funktioniert's:",
		},
		guide: {
			title: 'Wie funktioniert AllerLeih?',
			intro:
				'AllerLeih ist eine offene, gemeinwohlorientierte Plattform, auf der du Dinge aus- und verleihen kannst.',
			borrowing: {
				title: 'Ausleihen',
				steps: [
					{
						label: 'Suchen',
						text: 'Stöbere in der Suche nach Gegenständen aus deiner Umgebung. Wir bündeln für dich das lokale Angebot: von Freund:innen, aus der Nachbarschaft oder vom nächsten Leihladen.',
					},
					{
						label: 'Anfragen',
						text: 'Schreibe der verleihenden Person direkt. Falls sie Signal oder Telegram hinterlegt hat, auch darüber. Bei externen Angeboten wirst du unter Umständen weitergeleitet.',
					},
					{
						label: 'Austauschen',
						text: 'Macht miteinander aus, wo, wie und wann ihr die Übergabe(n) macht.',
					},
					{
						label: 'Zurückgeben',
						text: 'Gib den Gegenstand nach der Nutzung so zurück, wie du ihn gerne ausleihen würdest – AllerLeih lebt von Vertrauen und gegenseitigem Respekt.',
					},
				],
			},
			lending: {
				title: 'Verleihen',
				steps: [
					{
						label: 'Hochladen',
						text: 'Füge Dinge in deinem Profil hinzu. \
						Du kannst Dinge auch von unserer KI erkennen lassen, um Zeit zu sparen.',
					},
					{
						label: 'Vertrauen nutzen',
						text: 'Füge Vertraute hinzu oder schick ihnen eine Einladung. Stelle je Gegenstand ein, ob du ihn nur an Vertraute verleihen willst.',
					},
					{
						label: 'Anfragen empfangen',
						text: 'Interessierte melden sich direkt bei dir. Du entscheidest, ob und wann du verleihst.',
					},
					{
						label: 'Verfügbarkeit verwalten',
						text: 'Setze Gegenstände auf „nicht verfügbar", solange sie unterwegs sind oder du mal keine Zeit oder Lust auf neue Anfragen hast.',
					},
				],
			},
			faqTitle: 'Häufige Fragen',
			faqItems: [
				{
					q: 'Wer seid ihr?',
					a: 'Derzeit sind wir ein Duo: Timo und Matteo! Wir haben beide in Lüneburg studiert und wollen mit AllerLeih einen Beitrag zum Gemeinwohl leisten. Wir sind der Auffassung, dass das Teilen und Leihen in vielerlei Hinsicht eine bessere Alternative zum Kaufen ist. Und wir wollen, dass die Infrastruktur dafür nicht nur einfach und zugänglich ist, sondern auch nachhaltig für alle funktioniert. Deswegen entwickeln wir AllerLeih als gemeinnützige Organisation und Open-Source-Software. So verhindern wir die Kommerzialisierung und manipulative Algorithmen.',
				},
				{
					q: 'Was passiert, wenn etwas kaputt geht?',
					a: 'Wir bekommen die Frage häufiger und haben eine vielleicht etwas unbefriedigende Antwort: das, was sonst auch passieren würde. Wenn euer Gegenüber eine Haftpflicht hat, greift die. Oder ihr regelt das zwischen euch. Wir wollen bewusst keine Sozialtechnik wie Versicherungen oder Ähnliches anbieten, weil wir Vertrauen nicht outsourcen wollen. Über die Vertrauensfunktion habt ihr die volle Kontrolle darüber, an wen ihr verleiht. Wenn es doch einmal zu größeren Problemen kommt, meldet euch gerne und wir versuchen zu helfen!',
				},
				{
					q: 'Wie finanziert ihr euch?',
					a: 'Aktuell finanzieren wir uns aus eigener Tasche und suchen sehr aktiv nach Finanzierungsmöglichkeiten. Matteo ist zudem bis 2027 durch ein Stipendium der Studienstiftung des deutschen Volkes abgesichert. Falls ihr Ideen oder Kontakte habt, meldet euch gerne bei uns! Wir sind für alles offen, solange es zu unseren Werten passt.',
				},
				{
					q: 'Was habt ihr vor?',
					a: 'AllerLeih für alle! Wir wollen AllerLeih zu DER Plattform für das Teilen und Leihen machen. Im Gegensatz zu anderen Plattformen setzen wir dafür auf open-source und versuchen, ein dezentrales Modell zu entwickeln, das nicht von uns abhängt. In Zukunft soll also jeder Mensch in seiner Stadt, seinem Quartier oder seiner Kommune die Möglichkeit haben, eine eigene AllerLeih-Instanz zu betreiben und sich vor Ort um die Community zu kümmern.',
				},
				{
					q: 'Was passiert mit meinen Daten?',
					a: 'Wir sind noch im Aufbau und es gibt noch Allerlei(h) zu tun, deswegen läuft hier vielleicht noch nicht alles 100% rund. Aber digitale Freiheitsrechte (Persönlichkeitsrecht, Datenschutz, Teilhabe) sind für uns unverhandelbare Grundwerte und wir werden AllerLeih so entwickeln, dass ihr die volle Kontrolle über eure Daten habt. Zu jeder Zeit. Für immer. Das heißt: wir verkaufen keine Daten, Daten liegen auf Servern in Deutschland oder maximal der EU, und wir schützen eure Daten bestmöglich. Falls ihr feststellt, dass das nicht der Fall ist, meldet euch gerne sofort bei uns! Wir wollen transparent sein und Fehler schnellstmöglich beheben.',
				},
			],
		},
		search: {
			title: 'Suche',
			welcome: 'Nutze einfach die Suche oben oder',
			description:
				'Bei AllerLeih findest du allerlei Dinge aus deiner Umgebung zum leihen, teilen, mieten, ...',
			transportModePrompt: 'Wie transportierst du das Ding?',
			transportModes: {
				foot: 'Zu Fuß',
				bicycle: 'Fahrrad',
				car: 'Auto',
			},
			noLocation:
				'Aktiviere deinen Standort, um Reisezeiten zu sehen.',
			minutesAway: (n: number) => {
				if (n <= 5) return '<5 min';
				if (n <= 10) return '<10 min';
				if (n <= 15) return '<15 min';
				if (n <= 20) return '<20 min';
				if (n <= 25) return '<25 min';
				if (n <= 30) return '<30 min';
				return '>30 min';
			},
			durationFilter: {
				noLimit: '>30 min',
				maxMinutes: (n: number) => `<${n} min`,
				paginationHidden:
					'Entfernungsfilter aktiv – nur die aktuelle Seite wird gefiltert. Setze das Limit auf >30 min", um alle Seiten zu sehen.',
			},
			categoryFilterAnd: 'Alle Kategorien erfüllen (UND-Filter)',
			perPage: 'Pro Seite:',
			pageInfo: (current: number, total: number) => `Seite ${current} / ${total}`,
			browseAll: 'Alle Dinge zeigen',
			randomItemsHeading: 'Entdecke Gegenstände',
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
			title: 'Unterhaltungen',
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
			addBulk: 'Mit KI-Bilderkennung hochladen',
		},
		profile: {
			title: 'Mein Profil',
			emailVerified: 'E-Mail-Adresse bestätigt',
			emailNotVerified: 'E-Mail-Adresse noch nicht bestätigt',
			resendVerification: 'Bestätigungs-E-Mail erneut senden',
			verificationSent: 'Bestätigungs-E-Mail wurde gesendet.',
			notifications: {
				sectionTitle: 'Benachrichtigungen',
				description: 'Erhalte eine Benachrichtigung, wenn jemand deine Dinge anfragt oder dir schreibt.',
				enable: 'Benachrichtigungen aktivieren',
				enabled: 'Benachrichtigungen sind aktiviert.',
				deactivateThisDevice: 'Für dieses Gerät deaktivieren',
				deactivateAllDevices: 'Für alle meine Geräte deaktivieren',
				denied: 'Benachrichtigungen sind in deinem Browser blockiert. Du kannst sie in deinen Browser-Einstellungen wieder aktivieren.',
			},
		},
		invite: {
			sectionTitle: 'Freunde einladen',
			description: 'Teile diesen Link, um Freunde einzuladen. Alle, die sich darüber registrieren, werden dir automatisch vertrauen. Du wirst benachrichtigt, wenn jemand sich mit deiner Einladung registriert hat.',
			copyButton: 'Link kopieren',
			copied: 'Link kopiert!',
			welcomeMessage: (username: string) => `Du wurdest von ${username} eingeladen.`,
			noInvite: 'Du benötigst einen Einladungslink, um dich zu registrieren.',
			invalidInvite: 'Dieser Einladungslink ist ungültig.',
		},
		inviteLanding: {
			title: (name: string) => `${name} lädt dich ein!`,
			genericTitle: 'Du wurdest eingeladen!',
			description: 'Teile, leihe und hilf in deiner Umgebung – kostenlos und ohne Stress.',
			cta: 'Jetzt registrieren',
		},
		itemDetail: {
			backToSearch: '← Zurück zur Suche',
			requestButton: 'Anfragen',
			trustRestrictedTooltip: 'Dieser Gegenstand wird nur an vertraute Nutzer verliehen.',
			locationLabel: 'Ort',
			noImage: 'Kein Bild vorhanden',
			calculateTravelTime: 'Wegzeit berechnen',
		},
		userProfile: {
			activeSince: (date: string) => `Aktiv seit ${date}`,
			emailVerified: 'E-Mail-Adresse bestätigt',
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
			Alle Analysen finden auf den Servern von Mistral in Frankreich nach europäischem und französischem Recht statt.',
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
			denied: 'Standort konnte nicht abgerufen werden. Bitte stelle sicher dass du die Standortfreigabe in deinem Browser oder Betriebssytem aktiviert hast, um diese Funktion zu nutzen.',
		},
		pushNotifications: {
			title: 'Benachrichtigungen aktivieren?',
			explanation:
				'Erhalte eine Benachrichtigung, wenn jemand deine Dinge anfragen oder dir schreiben. Du kannst das jederzeit in den Browser-Einstellungen ändern.',
			allow: 'Benachrichtigungen aktivieren',
			denied: 'Benachrichtigungen sind in deinem Browser blockiert. Bitte stelle sicher, dass du Benachrichtigungen in deinem Browser oder Betriebssystem aktiviert hast, um diese Funktion zu nutzen.',
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

	// SEO meta titles and descriptions
	seo: {
		home: {
			title: 'AllerLeih – Dinge leihen und teilen in deiner Umgebung',
			description:
				'Kostenlos Gegenstände leihen und teilen mit Menschen in deiner Umgebung. Spare Geld, Platz und Ressourcen und stärke deine Gemeinschaft.',
		},
		search: {
			title: 'Gegenstände suchen – AllerLeih',
			description:
				'Durchsuche Gegenstände in deiner Nähe. Filtere nach Kategorie und Entfernung und finde, was du brauchst.',
		},
		about: {
			title: 'Über uns – AllerLeih',
			description:
				'AllerLeih ist eine gemeinnützige Plattform für lokales Leihen und Teilen. Lerne das Team dahinter kennen.',
		},
		guide: {
			title: 'Wie funktioniert AllerLeih? – Anleitung',
			description:
				'Schritt-für-Schritt-Anleitungen zum Leihen und Verleihen auf AllerLeih. Tipps, FAQs und erste Schritte.',
		},
		contact: {
			title: 'Kontakt – AllerLeih',
			description: 'Schreib uns! Fragen, Feedback oder Kooperationsanfragen sind herzlich willkommen.',
		},
		imprint: {
			title: 'Impressum – AllerLeih',
			description: 'Rechtliche Angaben und Kontaktinformationen des Betreibers von AllerLeih.',
		},
		newsletter: {
			title: 'AllerLeih News – Newsletter',
			description:
				'Bleib auf dem Laufenden: Abonniere den AllerLeih Newsletter für Neuigkeiten und Community-Geschichten.',
		},
		login: {
			title: 'Anmelden – AllerLeih',
			description:
				'Melde dich bei AllerLeih an, um Gegenstände zu leihen, Anfragen zu verwalten und dich mit deiner Umgebung zu verbinden.',
		},
		register: {
			title: 'Registrieren – AllerLeih',
			description:
				'Erstelle ein kostenloses AllerLeih-Konto und fang an, Dinge in deiner Umgebung zu leihen und zu teilen.',
		},
		itemDetail: (name: string, owner: string) => `${name} leihen bei ${owner} – AllerLeih`,
		itemDetailDescription: (name: string, owner: string, city: string) =>
			`Leihe ${name} von ${owner} in ${city} über AllerLeih – die kostenlose Plattform zum Teilen in deiner Umgebung.`,
		userProfile: (username: string) => `@${username} – AllerLeih`,
		userProfileDescription: (username: string) =>
			`Sieh dir die Gegenstände von @${username} auf AllerLeih an und kontaktiere ihn oder sie für eine Leihanfrage.`,
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

