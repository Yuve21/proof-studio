/**
 * The schema.org type vocabulary and the required-property table, VENDORED AS DATA.
 *
 * Same discipline as `corpus/aria-vocabulary.mjs`, and the same reason: when the
 * vocabulary is published by somebody else, vendor their list as data, keep it in
 * a different file from our logic, and be explicit about which direction a gap
 * fails in.
 *
 * BUT THIS VOCABULARY IS DIFFERENT FROM ARIA IN ONE WAY THAT CHANGES THE RULES
 * WE ARE ALLOWED TO WRITE, and it is the most important thing in this file.
 *
 * ARIA has roughly 90 roles and the published list is closed, so vendoring it
 * completely is possible and "this role does not exist" is a sound finding.
 * schema.org has more than eight hundred types and grows. The list below is a
 * SUBSET: the types that appear on the kind of site this product is pointed at.
 *
 * The consequence, stated plainly: **absence from this list is not evidence that
 * a type is invalid.** So there is no "unknown type" rule, and there must not be
 * one. A rule of that shape would report `@type: "Taxi"` as a mistake because we
 * did not happen to list a real type, and it would be accusing honest work of
 * being wrong, which is the direction the sibling product paid for twice: a
 * missing term on the counter side RAISED a score.
 *
 * What IS sound from a subset is a comparison that only fires on a POSITIVE
 * match. `@type: "localbusiness"` matches `LocalBusiness` case-insensitively and
 * differs from it exactly, and schema.org types are case-sensitive, so that is a
 * defect with no guessing in it. That is the only way `seo-structured-data` uses
 * this list, and it is why the list being incomplete costs coverage rather than
 * correctness.
 *
 * SOURCES
 *   - schema.org vocabulary, type hierarchy under Thing. Retrieved 2026-09-10.
 *   - Google Search Central, "Structured data general guidelines" and the
 *     per-feature reference pages, for which properties are REQUIRED rather than
 *     recommended. Retrieved 2026-09-10.
 *
 * WHAT THIS FILE CANNOT DO, said here rather than left to a reader. It cannot
 * tell you whether this snapshot is current, because nothing in this repository
 * makes a network request. Refreshing it is a manual step against the two sources
 * above and the date is the only claim about freshness.
 */

/**
 * Common schema.org types. Every entry here is a real type; the list is not
 * complete and does not claim to be. Used ONLY for the case comparison.
 */
export const KNOWN_TYPES = new Set([
  // the top of the hierarchy
  "Thing", "Action", "CreativeWork", "Event", "Intangible", "Organization", "Person",
  "Place", "Product", "BioChemEntity", "MedicalEntity", "Taxon",
  // organisations and businesses
  "Corporation", "EducationalOrganization", "GovernmentOrganization", "LocalBusiness",
  "NGO", "NewsMediaOrganization", "PerformingGroup", "SportsOrganization",
  "Airline", "Consortium", "FundingScheme", "LibrarySystem", "MedicalOrganization",
  "OnlineBusiness", "OnlineStore", "ResearchOrganization", "SearchRescueOrganization",
  "WorkersUnion", "ProfessionalService",
  // local business subtypes, which are the ones that actually appear in the wild
  "AnimalShelter", "ArchiveOrganization", "AutomotiveBusiness", "AutoDealer",
  "AutoRepair", "AutoBodyShop", "AutoPartsStore", "AutoRental", "AutoWash",
  "GasStation", "MotorcycleDealer", "MotorcycleRepair", "ChildCare", "Dentist",
  "DryCleaningOrLaundry", "EmergencyService", "EmploymentAgency",
  "EntertainmentBusiness", "AdultEntertainment", "AmusementPark", "ArtGallery",
  "Casino", "ComedyClub", "MovieTheater", "NightClub", "FinancialService",
  "AccountingService", "AutomatedTeller", "BankOrCreditUnion", "InsuranceAgency",
  "FoodEstablishment", "Bakery", "BarOrPub", "Brewery", "CafeOrCoffeeShop",
  "Distillery", "FastFoodRestaurant", "IceCreamShop", "Restaurant", "Winery",
  "GovernmentOffice", "PostOffice", "HealthAndBeautyBusiness", "BeautySalon",
  "DaySpa", "HairSalon", "HealthClub", "NailSalon", "TattooParlor",
  "HomeAndConstructionBusiness", "Electrician", "GeneralContractor", "HVACBusiness",
  "HousePainter", "Locksmith", "MovingCompany", "Plumber", "RoofingContractor",
  "InternetCafe", "LegalService", "Attorney", "Notary", "Library", "LodgingBusiness",
  "BedAndBreakfast", "Campground", "Hostel", "Hotel", "Motel", "Resort",
  "MedicalBusiness", "CommunityHealth", "Dermatology", "Optician", "Pharmacy",
  "Physician", "Physiotherapy", "PublicHealth", "RadioStation", "RealEstateAgent",
  "RecyclingCenter", "SelfStorage", "ShoppingCenter", "SportsActivityLocation",
  "BowlingAlley", "GolfCourse", "Gym", "PublicSwimmingPool", "SkiResort",
  "SportsClub", "StadiumOrArena", "TennisComplex", "Store", "BikeStore",
  "BookStore", "ClothingStore", "ComputerStore", "ConvenienceStore",
  "DepartmentStore", "ElectronicsStore", "Florist", "FurnitureStore",
  "GardenStore", "GroceryStore", "HardwareStore", "HobbyShop",
  "HomeGoodsStore", "JewelryStore", "LiquorStore", "MensClothingStore",
  "MobilePhoneStore", "MovieRentalStore", "MusicStore", "OfficeEquipmentStore",
  "OutletStore", "PawnShop", "PetStore", "ShoeStore", "SportingGoodsStore",
  "TireShop", "ToyStore", "WholesaleStore", "TelevisionStation",
  "TouristInformationCenter", "TravelAgency", "TrainStation",
  // creative works and pages
  "Article", "NewsArticle", "BlogPosting", "Blog", "TechArticle", "ScholarlyArticle",
  "Report", "Review", "Book", "Course", "Dataset", "DigitalDocument", "Episode",
  "Game", "VideoGame", "HowTo", "Message", "Movie", "MusicComposition",
  "MusicPlaylist", "MusicRecording", "Painting", "Photograph", "PodcastEpisode",
  "Presentation", "PublicationIssue", "Quotation", "Recipe", "Sculpture",
  "SoftwareApplication", "MobileApplication", "WebApplication", "TVEpisode",
  "TVSeries", "VideoObject", "AudioObject", "ImageObject", "MediaObject",
  "WebPage", "AboutPage", "CheckoutPage", "CollectionPage", "ContactPage",
  "FAQPage", "ItemPage", "MedicalWebPage", "ProfilePage", "QAPage", "RealEstateListing",
  "SearchResultsPage", "WebSite", "WebPageElement", "SiteNavigationElement",
  // intangibles: the ones that carry the commercial meaning
  "Offer", "AggregateOffer", "Demand", "Order", "OrderItem", "Invoice",
  "PriceSpecification", "UnitPriceSpecification", "DeliveryChargeSpecification",
  "PaymentChargeSpecification", "AggregateRating", "Rating", "Brand", "Service",
  "FinancialProduct", "LoanOrCredit", "PaymentCard", "Reservation",
  "FoodEstablishmentReservation", "LodgingReservation", "JobPosting",
  "Occupation", "Permit", "ProgramMembership", "Quantity", "Distance", "Duration",
  "Energy", "Mass", "ItemList", "ListItem", "BreadcrumbList", "OfferCatalog",
  "PropertyValue", "QuantitativeValue", "OpeningHoursSpecification",
  "GeoCoordinates", "GeoShape", "PostalAddress", "ContactPoint", "Language",
  "MonetaryAmount", "SearchAction", "ViewAction", "ReadAction", "OrderAction",
  "ReserveAction", "Question", "Answer", "Comment", "EntryPoint",
  // events and places
  "BusinessEvent", "ChildrensEvent", "ComedyEvent", "CourseInstance",
  "DeliveryEvent", "EducationEvent", "ExhibitionEvent", "Festival", "FoodEvent",
  "LiteraryEvent", "MusicEvent", "PublicationEvent", "SaleEvent", "ScreeningEvent",
  "SocialEvent", "SportsEvent", "TheaterEvent", "VisualArtsEvent",
  "AdministrativeArea", "City", "Country", "State", "CivicStructure", "Landform",
  "LandmarksOrHistoricalBuildings", "Residence", "TouristAttraction",
  "TouristDestination", "Accommodation", "Apartment", "House", "Room", "Suite",
  // products
  "IndividualProduct", "ProductGroup", "ProductModel", "SomeProducts", "Vehicle",
  "Car", "Motorcycle", "BusOrCoach",
]);

/**
 * A lowercase index, so a case comparison is a lookup rather than a scan.
 * Built from KNOWN_TYPES rather than written out, because two hand-maintained
 * spellings of the same fact is the defect this house names most often.
 */
export const TYPES_BY_LOWERCASE = new Map([...KNOWN_TYPES].map((t) => [t.toLowerCase(), t]));

/**
 * Properties Google documents as REQUIRED for the feature attached to a type,
 * not merely recommended.
 *
 * THIS TABLE IS DELIBERATELY SMALL AND IT FAILS QUIET. A type that is not a key
 * here produces NO missing-property finding at all, ever. That asymmetry is the
 * point: an over-eager required-property rule tells somebody their correct markup
 * is broken, and a customer who is told that once stops reading the report.
 *
 * `anyOf` is a list of alternatives where the specification accepts either. It
 * exists because `AggregateRating` is satisfied by `ratingCount` OR
 * `reviewCount`, and a rule that demanded both would be wrong on most valid
 * markup on the web.
 */
export const REQUIRED_PROPERTIES = {
  Article: { all: ["headline"], anyOf: [] },
  NewsArticle: { all: ["headline"], anyOf: [] },
  BlogPosting: { all: ["headline"], anyOf: [] },
  Product: { all: ["name"], anyOf: [] },
  Offer: { all: ["price", "priceCurrency"], anyOf: [] },
  AggregateOffer: { all: ["lowPrice", "priceCurrency"], anyOf: [] },
  AggregateRating: { all: ["ratingValue"], anyOf: [["ratingCount", "reviewCount"]] },
  Review: { all: ["author"], anyOf: [] },
  LocalBusiness: { all: ["name", "address"], anyOf: [] },
  Organization: { all: ["name"], anyOf: [] },
  Event: { all: ["name", "startDate", "location"], anyOf: [] },
  Recipe: { all: ["name"], anyOf: [] },
  JobPosting: { all: ["title", "description", "hiringOrganization"], anyOf: [] },
  VideoObject: { all: ["name", "thumbnailUrl", "uploadDate"], anyOf: [] },
  ImageObject: { all: ["contentUrl"], anyOf: [] },
  FAQPage: { all: ["mainEntity"], anyOf: [] },
  Question: { all: ["name", "acceptedAnswer"], anyOf: [] },
  BreadcrumbList: { all: ["itemListElement"], anyOf: [] },
  ListItem: { all: ["position"], anyOf: [["name", "item"]] },
  PostalAddress: { all: ["addressLocality", "addressCountry"], anyOf: [] },
  WebSite: { all: ["name", "url"], anyOf: [] },
  Person: { all: ["name"], anyOf: [] },
  Service: { all: ["name"], anyOf: [] },
  Course: { all: ["name", "description"], anyOf: [] },
  SoftwareApplication: { all: ["name"], anyOf: [] },
};

/**
 * Types where Google's guidelines specifically disallow review markup ABOUT the
 * marked-up entity itself, because the entity is the one publishing the page.
 * Cited rather than inferred: "Reviews and ratings that are self-serving are not
 * eligible" in the review-snippet guidelines, which names reviews about the
 * entity providing the markup.
 */
export const SELF_SERVING_REVIEW_HOSTS = new Set([
  "Organization", "LocalBusiness", "Corporation", "OnlineBusiness", "OnlineStore",
  "ProfessionalService", "Store", "Restaurant", "Hotel", "Dentist", "Attorney",
  "Plumber", "Electrician", "GeneralContractor", "HVACBusiness", "RoofingContractor",
  "MovingCompany", "Locksmith", "HousePainter", "BeautySalon", "HairSalon", "DaySpa",
  "Gym", "HealthClub", "TravelAgency", "InsuranceAgency", "RealEstateAgent",
  "AutoRepair", "AutoDealer", "MedicalBusiness", "Physician", "LegalService",
]);
