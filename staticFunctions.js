const fetch = require("node-fetch");
global.Headers = fetch.Headers;

function getRequestHeaders(){
	let h = new Headers();
	let auth = 'token ' + process.env.gh_token;
	h.append('Authorization', auth);
	return h;
}
exports.getRequestHeaders = getRequestHeaders;

function getValuesFromPayload(payload) {
    var vm = {
        action: payload.action != undefined ? payload.action : "",
        env : {
            organization: process.env.ado_organization != undefined ? process.env.ado_organization : "",
            orgurl: process.env.ado_organization != undefined ? "https://dev.azure.com/" + process.env.ado_organization : "",
            ado_token: process.env.ado_token != undefined ? process.env.ado_token : "",
            project: process.env.ado_project != undefined ? process.env.ado_project : "",
            ghrepo_owner: process.env.gh_repo_owner != undefined ? process.env.gh_repo_owner :"",
            ghrepo: process.env.gh_repo != undefined ? process.env.gh_repo :"",
            pull_number: process.env.pull_number != undefined ? process.env.pull_number :"",
            closedstate: process.env.closedstate != undefined ? process.env.closedstate :"",
            propenstate: process.env.propenstate != undefined ? process.env.propenstate :"",
            inprogressstate: process.env.inprogressstate != undefined ? process.env.inprogressstate :"",
            branch_name: process.env.branch_name != undefined ? process.env.branch_name :"",
	        gh_token: process.env.gh_token != undefined ? process.env.gh_token :""
        }
    }

    return vm;
}
exports.getValuesFromPayload = getValuesFromPayload;