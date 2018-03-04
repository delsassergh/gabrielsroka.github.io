var results;
var a;

if (location.host.match(/-admin/)) {
    results = createDiv("rockstar");
    if (location.pathname.match("/admin/user/")) {
        var id = location.pathname.split("/")[5];
        var user;
        $.getJSON(`/api/v1/users/${id}`).then(aUser => {
            user = aUser;
            var ad = user.credentials.provider.type == "ACTIVE_DIRECTORY";
            $(".subheader").html(user.profile.login + ", mail: " + user.profile.email + (ad ? ", " : ""));
            if (ad) {
                $("<a>").html("AD: " + user.credentials.provider.name).click(() => {
                    $.getJSON(`/api/v1/apps?filter=user.id+eq+"${id}"&expand=user/${id}&limit=200&q=active_directory`).then(appUsers => {
                        var results = createDiv("ADs");
                        var rows = "<tr><th>AD Domain<th>Username<th>Email";
                        appUsers.forEach(appUser => {
                            var user = appUser._embedded.user;
                            rows += `<tr><td>${appUser.label}<td>${user.credentials.userName}<td>${user.profile.email}`;
                        });
                        results.innerHTML = "<table class='data-list-table' style='border: 1px solid #ddd;'>" + rows + "</table>";
                    });
                }).appendTo(".subheader");
            }
        });
        a = results.appendChild(document.createElement("a"));
        a.innerHTML = "Show User<br>";
        a.onclick = function () {
            function toString(o, i) {
                var a = [], v, i = i || "";
                for (var p in o) {
                    if (p != "credentials" && p != "_links") {
                        if (o[p] === null) v = "null";
                        else if (typeof o[p] == "string") v = o[p].replace(/(["\\])/g, "\\$1"); // Escape " and \ 
                        else if (o[p] instanceof Array) v = "[" + o[p].toString() + "]";
                        else if (typeof o[p] == "object") v = "{\n" + toString(o[p], i + "\t") + i + "}";
                        else v = o[p];
                        a.push(i + p + ": " + v);
                    }
                }
                return a.join("\n") + "\n";
            }
            var results = createDiv("User");
            results.innerHTML = "<span class='icon icon-24 group-logos-24 logo-" + user.credentials.provider.type.toLowerCase() + "'></span><pre>" + toString(user) + "</pre>";
        };
        a = results.appendChild(document.createElement("a"));
        a.innerHTML = "Administrator Roles<br>";
        a.onclick = function () {
            var allRoles = [
                {type: "SUPER_ADMIN", label: "Super"},
                {type: "ORG_ADMIN", label: "Organization"},
                {type: "APP_ADMIN", label: "Application"},
                {type: "USER_ADMIN", label: "User"},
                {type: "HELP_DESK_ADMIN", label: "Help Desk"},
                {type: "READ_ONLY_ADMIN", label: "Read-only"},
                {type: "MOBILE_ADMIN", label: "Mobile"}
                // {type: "API_ACCESS_MANAGEMENT_ADMIN", label: "API Access Management"} // API AM doesn't show up when you GET.
            ];
            var results = createDiv("Administrator Roles");
            showRoles();
            function showRoles() {
                $.getJSON(`/api/v1/users/${id}/roles`).then(roles => {
                    if (roles.length == 0) {
                        results.innerHTML = "This user is not an admin.<br><br>";
                        allRoles.forEach(role => {
                            a = results.appendChild(document.createElement("a"));
                            a.innerHTML = `Grant ${role.label} Administrator<br>`;
                            a.onclick = function () {
                                var data = {
                                    type: role.type
                                };
                                // https://developer.okta.com/docs/api/resources/roles#assign-role-to-user
                                postJson({
                                    url: `/api/v1/users/${id}/roles`,
                                    data
                                }).then(() => setTimeout(showRoles, 1000));
                            };
                        });
                    } else {
                        results.innerHTML = "";
                        roles.forEach(role => {
                            a = results.appendChild(document.createElement("a"));
                            a.innerHTML = `Revoke ${role.label}<br>`;
                            a.onclick = function () {
                                // https://developer.okta.com/docs/api/resources/roles#unassign-role-from-user
                                $.ajax({
                                    url: `/api/v1/users/${id}/roles/${role.id}`,
                                    method: "DELETE"
                                }).then(() => setTimeout(showRoles, 1000));
                            };
                        });
                    }
                });
            }
            function postJson(settings) {
                settings.contentType = "application/json";
                settings.data = JSON.stringify(settings.data);
                return $.post(settings);
            }
        };
    }
    a = results.appendChild(document.createElement("a"));
    a.innerHTML = "Export Objects<br>";
    a.onclick = function () {
        var total;
        var objectType;
        var results;
        var logger;
        var groups;
        var csv;
        if (location.pathname == "/admin/users") {
            // see also Reports > Reports, Okta Password Health: https://ORG-admin.oktapreview.com/api/v1/users?format=csv
            getObjects("Users", "/users", "id,firstName,lastName,login,email,credentialType", function (user) {
                return user.id + ',"' + user.profile.firstName + '","' + user.profile.lastName + '","' + user.profile.login + '","' + user.profile.email + '",' + user.credentials.provider.type;
            });
        } else if (location.pathname == "/admin/groups") {
            getObjects("Groups", "/groups", "id,name,description,type", function (group) {
                return group.id + ',"' + group.profile.name + '","' + (group.profile.description || "") + '",' + group.type;
            });
        } else {
            var appid = getAppId();
            if (appid) {
                results = createDiv("Export");
                a = results.appendChild(document.createElement("a"));
                a.innerHTML = "Export Groups";
                a.onclick = function () {
                    document.body.removeChild(results.parentNode);
                    getObjects("App Groups", "/apps/" + appid + "/groups", "id,licenses,roles", function (appgroup) {
                        callAPI("/groups/" + appgroup.id, function () {
                            var group = JSON.parse(this.responseText);
                            groups.push(group.profile.name + "," + (appgroup.profile.licenses ? appgroup.profile.licenses.join(";") : "") +
                                "," + (appgroup.profile.roles ? appgroup.profile.roles.join(";") : ""));
                            if (groups.length == total) {
                                console.log("name,licenses,roles");
                                for (var g = 0; g < groups.length; g++) {
                                    console.log("," + groups[g]);
                                }
                            }
                        });
                        return appgroup.id + "," + (appgroup.profile.licenses ? appgroup.profile.licenses.join(";") : "") +
                            "," + (appgroup.profile.roles ? appgroup.profile.roles.join(";") : "");
                    });
                };
                results.appendChild(document.createElement("br"));
                a = results.appendChild(document.createElement("a"));
                a.innerHTML = "Export Users";
                a.onclick = function () {
                    document.body.removeChild(results.parentNode);
                    getObjects("App Users", "/apps/" + appid + "/users", "userName", function (appuser) {
                        return appuser.credentials.userName;
                    });
                };
            } else {
                results = createDiv("Export");
                results.innerHTML = "<br>Error. Go to one of these:<br><br>" + 
                    "<a href='/admin/users'>Directory > People</a><br>" + 
                    "<a href='/admin/groups'>Directory > Groups</a><br>" +
                    "<a href='/admin/people/directories'>Directory > Directory Integrations</a> and click on a directory<br>" +
                    "<a href='/admin/apps/active'>Applications > Applications</a> and click on an app<br>";
            }
        }
        function getObjects(title, path, header, logCallback) {
            total = 0;
            objectType = title;
            results = createDiv(title);
            results.innerHTML = "Loading ...";
            logger = logCallback;
            csv = [header];
            groups = [];
            callAPI(path, exportObjects);
        }
        function exportObjects() {
            if (this.responseText) {
                var objects = JSON.parse(this.responseText);
                for (var i = 0; i < objects.length; i++) {
                    csv.push(logger(objects[i]));
                }
                total += objects.length;
                results.innerHTML = total + " " + objectType + "...";
                var links = getLinks(this.getResponseHeader("Link"));
                if (links && links.next) {
                    var path = links.next.replace(/.*api.v1/, ""); // links.next is an absolute URL; we need a relative URL.
                    if (this.getResponseHeader("X-Rate-Limit-Remaining") && this.getResponseHeader("X-Rate-Limit-Remaining") < 10) {
                        var interval = setInterval(() => {
                            results.innerHTML += "<br>Sleeping...";
                            if ((new Date()).getTime() / 1000 > this.getResponseHeader("X-Rate-Limit-Reset")) {
                                clearInterval(interval);
                                callAPI(path, exportObjects);
                            }
                        }, 1000);
                    } else {
                        callAPI(path, exportObjects);
                    }
                } else {
                    results.innerHTML = total + " " + objectType + ". Done.";
                    a = results.appendChild(document.createElement("a"));
                    a.href = "data:application/csv;charset=utf-8," + encodeURIComponent(csv.join("\n"));
                    var date = (new Date()).toISOString().replace(/T/, " ").replace(/:/g, "-").substr(0, 19);
                    a.download = "Export " + objectType + " " + date + ".csv";
                    a.click();
                }
            }
        }
        function getLinks(headers) {
            headers = headers.split(", ");
            var links = {};
            for (var i = 0; i < headers.length; i++) {
                var matches = headers[i].match(/<(.*)>; rel="(.*)"/);
                links[matches[2]] = matches[1];
            }
            return links;
        }
        function getAppId() {
            var path = location.pathname;
            var pathparts = path.split(/\//);
            if (path.match(/admin\/app/) && (pathparts.length == 6 || pathparts.length == 7)) {
                return pathparts[5];
            }
        }
    };
    if (location.pathname == "/admin/users") { // Directory > People
        maker({
            url: "/api/v1/users",
            data: function () {return {q: this.search, limit: this.limit};}, // Do not use an arrow function for a method -- it breaks `this`.
            limit: 15, // 15 is the max limit when using q.
            comparer: (user1, user2) => (user1.profile.firstName + user1.profile.lastName).localeCompare(user2.profile.firstName + user2.profile.lastName),
            template: user => {
                var creds = user.credentials.provider;
                var logo = creds.type == "LDAP" ? "ldap_sun_one" : creds.type.toLowerCase();
                return `<tr><td><span class='icon icon-24 group-logos-24 logo-${logo}'></span> ${creds.name == "OKTA" ? "Okta" : creds.name}` +
                    `<td><a href="/admin/user/profile/view/${user.id}#tab-account">${user.profile.firstName} ${user.profile.lastName}</a>` +
                    `<td>${user.profile.login}<td>${user.profile.email}`;
            },
            headers: "<tr><th>Source<th>Person<th>Username<th>Primary Email",
            empty: true
        });
    }
} else if (location.pathname == "/app/UserHome") { // non-admin
    results = createDiv("rockstar");
    a = results.appendChild(document.createElement("a"));
    a.innerHTML = "Show SSO<br>";
    a.onclick = function () {
        var results;
        var label = "Show SSO";
        var labels = document.getElementsByClassName("app-button-name");
        if (labels.length > 0) { // Button labels on Okta homepage
            for (var i = 0; i < labels.length; i++) {
                if (!labels[i].innerHTML.match(label)) {
                    var a = document.createElement("a");
                    a.onclick = function () {
                        getDiv();
                        getSSO(this.parentNode.previousSibling.previousSibling.href);
                    };
                    if (labels[i].clientHeight <= 17) {
                        a.innerHTML = "<br>" + label;
                    } else {
                        a.innerHTML = " - " + label;
                    }
                    labels[i].appendChild(a);
                }
            }
        } else {
            getDiv();
            var form = results.appendChild(document.createElement("form"));
            var url = form.appendChild(document.createElement("input"));
            url.style.width = "700px";
            url.placeholder = "URL";
            url.focus();
            var input = form.appendChild(document.createElement("input"));
            input.type = "submit";
            input.value = label;
            form.onsubmit = function () {
                getSSO(url.value);
                return false;
            };
        }
        function getSSO(url) {
            results.innerHTML = "Loading . . .";
            var request = new XMLHttpRequest();
            request.open("GET", url);
            request.onload = showSSO;
            request.send();
        }
        function showSSO() {
            function unentity(s) {
                return s.replace(/&#(x..?);/g, function (m, p1) {return String.fromCharCode("0" + p1)});
            }
            var highlight = "style='background-color: yellow'";
            var matches;
            if (matches = this.responseText.match(/name="(SAMLResponse|wresult)".*value="(.*?)"/)) {
                var assertion = unentity(matches[2]);
                if (matches[1] == "SAMLResponse") assertion = atob(assertion);
                console.log(assertion);
                assertion = assertion.replace(/\n/g, "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&gt;&lt;/g, "&gt;\n&lt;").
                    replace(/((SignatureValue|X509Certificate)&gt;.{80})(.*)&lt;/g, "$1<span title='$3' " + highlight + ">...</span>&lt;").
                    replace(/((Address|Issuer|NameID|NameIdentifier|Name|AttributeValue|Audience|Destination|Recipient)(.*&gt;|="|=&quot;))(.*?)(&lt;|"|&quot;)/g, "$1<span " + highlight + ">$4</span>$5");
                var postTo = unentity(this.responseText.match(/<form id="appForm" action="(.*?)"/)[1]);
                results.innerHTML = "<br>Post to: " + postTo + "<br><br><pre>" + indentXml(assertion, 4) + "</pre>";
            } else if (matches = this.responseText.match(/<form(?:.|\n)*<\/form>/)) {
                var form = matches[0].replace(/ *</g, "&lt;").replace(/>/g, "&gt;").
                    replace(/value="(.*?)"/g, 'value="<span title="$1" ' + highlight + '>...</span>"');
                results.innerHTML = "<br><pre>" + form + "</pre>";
            } else if (matches = this.responseText.match(/<div class="error-content">(?:.|\n)*?<\/div>/)) {
                results.innerHTML = "<br><pre>" + matches[0] + "</pre>";
            } else {
                results.innerHTML = "<br>Is this a SWA app, plugin or bookmark?";
            }
        }
        function getDiv() {
            results = createDiv("SSO");
        }
        function indentXml(xml, size) {
            var lines = xml.split("\n");
            var level = 0;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var end = line.match("&lt;/");
                var empty = line.match("/&gt;") || line.match(/&gt;.*&gt;/);
                if (end && !empty) level--;
                lines[i] = " ".repeat(size * level) + line;
                if (!end && !empty) level++;
            }
            return lines.join("\n");
        }
    };
} else {
    // Don't show results div.
    if (location.pathname == "/su/orgs") { // SU > Orgs
        maker({
            url: "/api/internal/su/orgs",
            data: function () {return {search: this.search, limit: this.limit};},
            limit: 100, // 100 is the max limit for this url.
            filter: org => org.edition != "Developer",
            comparer: (org1, org2) => org1.subdomain.localeCompare(org2.subdomain),
            template: org => {
                var href = `${org.cellURL || ""}/su/org/${org.id}`;
                return `<tr><td><a href="${href}">${org.subdomain}</a>` +
                    `<td>${org.name}` +
                    `<td><a class='link-button' href="${href}/beta-features#tab-ea-features">EA</a> ` +
                        `<a class='link-button' href="${href}/beta-features#tab-ga-features">GA</a>` +
                    `<td>${org.cell}`;
            },
            headers: "<tr><th>Subdomain<th>Name<th>Features<th>Cell",
            placeholder: "Search 100...",
            empty: true
        });
    } else if (location.pathname.match("/su/org/")) { // SU > Org Users
        maker({
            url: location.pathname + "/users/search",
            data: function () {return {sSearch: this.search, sColumns: "fullName,login,userId,email,tempSignOn", iDisplayLength: 10};},
            comparer: (user1, user2) => user1.fullName.localeCompare(user2.fullName),
            template: user => `<tr class=odd><td>${user.fullName}<td>${user.login}<td><a href="${location.pathname}/user-summary/${user.userId}">${user.userId}</a>` + 
                `<td>${user.email}<td>${user.tempSignOn}`,
            headers: "<tr><th>Name<th>Login<th>ID<th>Email<th>Temp Sign On",
            placeholder: "Search 10...",
            $search: "#user-grid_filter",
            $table: "#user-grid",
            dataType: "text"
        });
    }
}
$.ajaxSetup({headers: {"X-Okta-XsrfToken": document.getElementById("_xsrfToken").innerText}});
function callAPI(path, onload, method, body) {
    var request = new XMLHttpRequest();
    request.open(method || "GET", "/api/v1" + path);
    request.setRequestHeader("X-Okta-XsrfToken", document.getElementById("_xsrfToken").innerText);
    request.setRequestHeader("Content-Type", "application/json");
    request.setRequestHeader("Accept", "application/json");
    request.onload = onload;
//    request.onprogress = function (event) {
//        results.innerHTML = event.loaded + " bytes loaded.";
//    };
    request.send(body ? JSON.stringify(body) : null);
}
function createDiv(title) {
    var div = document.body.appendChild(document.createElement("div"));
    div.innerHTML = "<a onclick='document.body.removeChild(this.parentNode)'>" + title + " - close</a> " +
        "<a href='https://gabrielsroka.github.io/' target='_blank'>?</a><br><br>";
    div.style.position = "absolute";
    div.style.zIndex = "1000";
    div.style.left = "4px";
    div.style.top = "4px";
    div.style.backgroundColor = "white";
    div.style.padding = "8px";
    div.style.border = "1px solid #ddd";
    return div.appendChild(document.createElement("div"));
}
function maker(object) {
    function searchObjects() {
        $.get({
            url: object.url, 
            data: object.data(),
            dataType: object.dataType || "json"
        }).then(function (data) {
            var objects;
            if (object.dataType == "text") {
                var json = JSON.parse(data.substr(11));
                var properties = json.userSearchQuery.properties;
                objects = [];
                for (var i = 0; i < json.aaData.length; i++) {
                    var o = {};
                    for (var p = 0; p < properties.length; p++) {
                        o[properties[p]] = json.aaData[i][p];
                    }
                    objects.push(o);
                }
            } else {
                objects = data;
            }
            var rows = "";
            if (object.filter) objects = objects.filter(object.filter);
            objects.sort(object.comparer).forEach(o => rows += object.template(o));
            $(object.$table || ".data-list-table").html(`<thead>${object.headers}</thead>` + rows);
            if (object.empty) {
                if (objects.length == 0) {
                    $(".data-list-empty-msg").show();
                } else {
                    $(".data-list-empty-msg").hide();
                }
            }
        });
    }

    var timeoutID = 0;
    $(object.$search || ".data-list .data-list-toolbar")
        .html(`<input type='text' class='text-field-default' placeholder='${object.placeholder || "Search..."}'>`)
        .find("input")
        .keyup(function () {
            if (object.search == this.value || this.value.length < 2) return;
            object.search = this.value;
            clearTimeout(timeoutID);
            timeoutID = setTimeout(searchObjects, 400);
        }
    );
}